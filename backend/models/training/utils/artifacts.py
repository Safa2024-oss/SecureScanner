import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import joblib


def safe_git_commit() -> str:
    try:
        out = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
        return out
    except Exception:
        return "unknown"


def save_model_artifacts(artifact_dir: Path, model, vectorizer, model_filename: str, vectorizer_filename: str) -> None:
    artifact_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, artifact_dir / model_filename)
    if vectorizer is not None:
        joblib.dump(vectorizer, artifact_dir / vectorizer_filename)


def write_metadata(
    report_dir: Path,
    metadata: dict,
) -> None:
    out = dict(metadata)
    out.setdefault("training_date", datetime.now(timezone.utc).isoformat())
    out.setdefault("git_commit", safe_git_commit())
    path = report_dir / "metadata.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

