import json
from pathlib import Path
import pandas as pd

from .security import file_sha256
from .paths import ROOT, ensure_dir, resolve_dataset_path


LEAKAGE_TERMS = [
    "fix",
    "patched",
    "patch",
    "remediation",
    "resolved",
    "after_fix",
]


def load_dataset(dataset_path: str) -> pd.DataFrame:
    path = resolve_dataset_path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path} (resolved: {path})")
    return pd.read_csv(path, low_memory=False)


def validate_columns(df: pd.DataFrame, required_columns: list[str]) -> None:
    missing = [c for c in required_columns if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def clean_rows(df: pd.DataFrame, required_non_null: list[str], dedup_subset: list[str] | None = None) -> pd.DataFrame:
    out = df.dropna(subset=required_non_null).copy()
    if dedup_subset:
        out = out.drop_duplicates(subset=dedup_subset)
    return out


def enforce_leakage_guards(text_column: str) -> None:
    low = text_column.lower()
    for term in LEAKAGE_TERMS:
        if term in low:
            raise ValueError(
                f"Potential leakage detected: text column '{text_column}' includes term '{term}'. "
                "Use a pre-fix/pre-remediation code/text field."
            )


def write_dataset_manifest(dataset_path: str, df: pd.DataFrame, model_name: str) -> dict:
    manifests_dir = ensure_dir(ROOT / "datasets" / "manifests")
    resolved = resolve_dataset_path(dataset_path)
    dataset_name = resolved.name
    manifest = {
        "model_name": model_name,
        "dataset_name": dataset_name,
        "dataset_path": str(resolved),
        "dataset_hash": file_sha256(str(resolved)),
        "row_count": int(len(df)),
        "columns": list(df.columns),
    }
    manifest_path = manifests_dir / f"{model_name}_manifest.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return manifest

