import argparse
from pathlib import Path

import pandas as pd

from utils.config_loader import load_config
from utils.pipeline import run_text_classifier_training


def build_severity_label(df: pd.DataFrame):
    scores = pd.to_numeric(df["Score"], errors="coerce").fillna(5.0)
    labels = []
    for s in scores:
        if s < 4:
            labels.append("Low")
        elif s < 7:
            labels.append("Medium")
        elif s < 9:
            labels.append("High")
        else:
            labels.append("Critical")
    return pd.Series(labels)


def main():
    parser = argparse.ArgumentParser(description="Train severity model.")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "severity.json"))
    args = parser.parse_args()
    cfg = load_config(args.config)
    result = run_text_classifier_training(model_name="severity", config=cfg, label_builder=build_severity_label)
    print(f"[INFO] severity artifacts: {result.artifact_dir}")
    print(f"[INFO] severity report: {result.report_dir}")


if __name__ == "__main__":
    main()

