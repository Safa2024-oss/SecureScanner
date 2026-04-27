import argparse
from pathlib import Path

import pandas as pd

from utils.config_loader import load_config
from utils.pipeline import run_text_classifier_training


def build_risk_label(df: pd.DataFrame):
    score_col_candidates = ["Score", "cvss_score", "CVSS Score", "cvss", "base_score", "score"]
    score_col = next((c for c in score_col_candidates if c in df.columns), None)
    if score_col is None:
        raise ValueError(
            f"Risk labeling requires a score column. Expected one of: {score_col_candidates}. "
            f"Found columns: {list(df.columns)}"
        )

    scores = pd.to_numeric(df[score_col], errors="coerce")
    labels = pd.Series("Medium", index=df.index, dtype="object")
    labels[scores < 4] = "Low"
    labels[(scores >= 7) & (scores < 9)] = "High"
    labels[scores >= 9] = "Critical"

    unique = labels.nunique()
    if unique < 2:
        raise ValueError(
            f"Risk label generation produced only {unique} class ({labels.iloc[0]}). "
            "Check score distribution or dataset quality."
        )
    return labels


def main():
    parser = argparse.ArgumentParser(description="Train risk model.")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "risk.json"))
    args = parser.parse_args()
    cfg = load_config(args.config)
    result = run_text_classifier_training(model_name="risk", config=cfg, label_builder=build_risk_label)
    print(f"[INFO] risk artifacts: {result.artifact_dir}")
    print(f"[INFO] risk report: {result.report_dir}")


if __name__ == "__main__":
    main()

