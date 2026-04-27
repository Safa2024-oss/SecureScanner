from pathlib import Path
from datetime import datetime


ROOT = Path(__file__).resolve().parents[2]  # backend/models
PROJECT_ROOT = ROOT.parents[1]  # SecureScanner repo root


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_artifact_dir(model_name: str) -> Path:
    return ensure_dir(ROOT / "artifacts" / model_name)


def get_report_run_dir(model_name: str) -> Path:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return ensure_dir(ROOT / "reports" / f"{timestamp}_{model_name}")


def resolve_dataset_path(dataset_path: str) -> Path:
    candidate = Path(dataset_path)
    if candidate.is_absolute():
        return candidate

    # Support configs that reference paths from project root, e.g. backend/models/...
    project_relative = PROJECT_ROOT / candidate
    if project_relative.exists():
        return project_relative

    # Fallback: resolve from current working directory.
    return candidate.resolve()

