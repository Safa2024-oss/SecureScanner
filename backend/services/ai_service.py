import json
from pathlib import Path
import joblib


MODEL_ROOT = Path(__file__).resolve().parents[1] / "models"
ARTIFACTS_ROOT = MODEL_ROOT / "artifacts"

DEFAULT_THRESHOLDS = {
    "high_confidence": 0.85,
    "medium_confidence": 0.65,
    "low_confidence": 0.45,
    "manual_review_below": 0.45,
}


def load_joblib(path: Path):
    if not path.exists():
        print(f"[WARN] Not found: {path}")
        return None
    try:
        return joblib.load(path)
    except Exception as e:
        print(f"[WARN] Failed to load {path}: {e}")
        return None


def load_thresholds(model_name: str) -> dict:
    threshold_path = ARTIFACTS_ROOT / model_name / "threshold_recommendations.json"
    if not threshold_path.exists():
        return DEFAULT_THRESHOLDS.copy()
    try:
        with threshold_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return {
            "high_confidence": float(data.get("high_confidence", DEFAULT_THRESHOLDS["high_confidence"])),
            "medium_confidence": float(data.get("medium_confidence", DEFAULT_THRESHOLDS["medium_confidence"])),
            "low_confidence": float(data.get("low_confidence", DEFAULT_THRESHOLDS["low_confidence"])),
            "manual_review_below": float(data.get("manual_review_below", DEFAULT_THRESHOLDS["manual_review_below"])),
        }
    except Exception as e:
        print(f"[WARN] Failed to load thresholds {threshold_path}: {e}")
        return DEFAULT_THRESHOLDS.copy()


def load_model_bundle(model_name: str) -> dict:
    model_path = ARTIFACTS_ROOT / model_name / "model.joblib"
    vectorizer_path = ARTIFACTS_ROOT / model_name / "vectorizer.joblib"
    thresholds = load_thresholds(model_name)
    return {
        "model": load_joblib(model_path),
        "vectorizer": load_joblib(vectorizer_path),
        "thresholds": thresholds,
    }


confidence_bundle = load_model_bundle("confidence")
vuln_type_bundle = load_model_bundle("vuln_type")
risk_bundle = load_model_bundle("risk")
severity_bundle = load_model_bundle("severity")

loaded = sum(
    1
    for m in [
        confidence_bundle["model"],
        confidence_bundle["vectorizer"],
        vuln_type_bundle["model"],
        risk_bundle["model"],
        risk_bundle["vectorizer"],
        severity_bundle["model"],
        severity_bundle["vectorizer"],
    ]
    if m is not None
)
print(f"[INFO] AI Pipeline: {loaded}/7 artifact components loaded")


# ── MODEL 1: CONFIDENCE SCORE ─────────────────────────────
def predict_confidence(text: str) -> int:
    model = confidence_bundle["model"]
    vectorizer = confidence_bundle["vectorizer"]
    if model is not None and vectorizer is not None:
        try:
            features = vectorizer.transform([text])
            proba = model.predict_proba(features)[0]
            classes = list(model.classes_)
            if "vulnerable" in classes:
                idx = classes.index("vulnerable")
            else:
                idx = 1
            return round(proba[idx] * 100)
        except Exception as e:
            print(f"Confidence error: {e}")
    return rule_based_confidence(text)


# ── MODEL 2: VULNERABILITY TYPE ───────────────────────────
def predict_vuln_type(text: str) -> str:
    model = vuln_type_bundle["model"]
    vectorizer = vuln_type_bundle["vectorizer"]
    if model is not None:
        try:
            if vectorizer is not None:
                features = vectorizer.transform([text])
                result = model.predict(features)[0]
            else:
                result = model.predict([text])[0]
            return str(result)
        except Exception as e:
            print(f"Vuln type error: {e}")
    return None


# ── MODEL 3: RISK LEVEL ───────────────────────────────────
def predict_risk(text: str) -> str:
    model = risk_bundle["model"]
    vectorizer = risk_bundle["vectorizer"]
    if model is not None and vectorizer is not None:
        try:
            features = vectorizer.transform([text])
            result = model.predict(features)[0]
            return str(result)
        except Exception as e:
            print(f"Risk error: {e}")
    return None


# ── MODEL 4: SEVERITY ─────────────────────────────────────
def predict_severity(text: str) -> str:
    model = severity_bundle["model"]
    vectorizer = severity_bundle["vectorizer"]
    if model is not None:
        try:
            if vectorizer is not None:
                features = vectorizer.transform([text])
                result = model.predict(features)[0]
            else:
                result = model.predict([text])[0]
            return str(result)
        except Exception as e:
            print(f"Severity error: {e}")
    return None


# ── FALLBACK ──────────────────────────────────────────────
def rule_based_confidence(text: str) -> int:
    text = text.lower()
    if any(k in text for k in ["sql", "select", "insert", "delete"]):
        return 75
    if any(k in text for k in ["xss", "innerhtml", "script", "document.write"]):
        return 72
    if any(k in text for k in ["password", "secret", "token", "api_key"]):
        return 68
    if any(k in text for k in ["eval", "exec", "shell", "subprocess"]):
        return 70
    return 45


def confidence_bucket(confidence_pct: int) -> str:
    score = confidence_pct / 100.0
    thresholds = confidence_bundle["thresholds"]
    if score >= thresholds["high_confidence"]:
        return "high"
    if score >= thresholds["medium_confidence"]:
        return "medium"
    if score >= thresholds["low_confidence"]:
        return "low"
    return "needs_manual_review"


# ── MAIN PIPELINE ─────────────────────────────────────────
def analyze_vulnerabilities(vulnerabilities: list) -> list:
    result = []

    for vuln in vulnerabilities:
        code = str(vuln.get("code", "") or "")
        description = str(vuln.get("description", "") or "")
        text = code + " " + description

        vuln_copy = vuln.copy()

        # 1 — Confidence score (is it really vulnerable?)
        confidence = predict_confidence(text)
        vuln_copy["confidence"] = confidence
        bucket = confidence_bucket(confidence)
        vuln_copy["confidence_bucket"] = bucket
        vuln_copy["ai_verdict"] = (
            "Confirmed" if bucket == "high"
            else "Likely" if bucket in ["medium", "low"]
            else "Review"
        )

        # 2 — Vulnerability type from MSR model
        vuln_type = predict_vuln_type(text)
        if vuln_type:
            vuln_copy["ai_vuln_type"] = vuln_type

        # 3 — Risk level
        risk = predict_risk(text)
        if risk:
            vuln_copy["risk_level"] = risk

        # 4 — AI predicted severity
        ai_severity = predict_severity(text)
        if ai_severity:
            vuln_copy["ai_severity"] = ai_severity

        result.append(vuln_copy)

    return result