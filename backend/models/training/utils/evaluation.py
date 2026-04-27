import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix,
)


def _confidence_bucket(score: float, thresholds: dict) -> str:
    if score >= thresholds["high_confidence"]:
        return "high"
    if score >= thresholds["medium_confidence"]:
        return "medium"
    if score >= thresholds["low_confidence"]:
        return "low"
    return "needs_manual_review"


def compute_classification_metrics(y_true, y_pred) -> dict:
    p_micro, r_micro, f_micro, _ = precision_recall_fscore_support(y_true, y_pred, average="micro", zero_division=0)
    p_macro, r_macro, f_macro, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    p_weighted, r_weighted, f_weighted, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision_micro": p_micro,
        "recall_micro": r_micro,
        "f1_micro": f_micro,
        "precision_macro": p_macro,
        "recall_macro": r_macro,
        "f1_macro": f_macro,
        "precision_weighted": p_weighted,
        "recall_weighted": r_weighted,
        "f1_weighted": f_weighted,
    }


def recommend_thresholds(y_true, y_pred_proba) -> dict:
    # SaaS-safe defaults; can be replaced by PR-curve optimization in future.
    mean_conf = float(np.mean(np.max(y_pred_proba, axis=1))) if len(y_pred_proba) else 0.0
    high = min(0.95, max(0.75, mean_conf + 0.10))
    medium = min(high - 0.05, 0.65)
    low = min(medium - 0.10, 0.45)
    return {
        "high_confidence": round(high, 3),
        "medium_confidence": round(medium, 3),
        "low_confidence": round(low, 3),
        "manual_review_below": round(low, 3),
    }


def save_eval_outputs(
    report_dir: Path,
    labels: list[str],
    y_true,
    y_pred,
    y_pred_proba,
    sample_texts: list[str],
    thresholds: dict,
) -> dict:
    metrics = compute_classification_metrics(y_true, y_pred)
    cls_report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
    conf = confusion_matrix(y_true, y_pred, labels=labels)

    metrics_path = report_dir / "metrics.json"
    report_path = report_dir / "classification_report.json"
    conf_path = report_dir / "confusion_matrix.csv"
    threshold_path = report_dir / "threshold_recommendations.json"
    errors_path = report_dir / "error_analysis.csv"
    dist_path = report_dir / "class_distribution.json"

    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    with report_path.open("w", encoding="utf-8") as f:
        json.dump(cls_report, f, indent=2)
    pd.DataFrame(conf, index=labels, columns=labels).to_csv(conf_path)
    with threshold_path.open("w", encoding="utf-8") as f:
        json.dump(thresholds, f, indent=2)

    # Error analysis
    max_conf = np.max(y_pred_proba, axis=1) if len(y_pred_proba) else np.array([])
    rows = []
    for i, (yt, yp) in enumerate(zip(y_true, y_pred)):
        if yt != yp:
            conf_score = float(max_conf[i]) if len(max_conf) else 0.0
            rows.append(
                {
                    "index": i,
                    "true_label": yt,
                    "predicted_label": yp,
                    "confidence": round(conf_score, 6),
                    "confidence_bucket": _confidence_bucket(conf_score, thresholds),
                    "sample_text": sample_texts[i] if i < len(sample_texts) else "",
                }
            )
    pd.DataFrame(rows).to_csv(errors_path, index=False)

    class_dist = pd.Series(y_true).value_counts().to_dict()
    with dist_path.open("w", encoding="utf-8") as f:
        json.dump(class_dist, f, indent=2)

    return metrics

