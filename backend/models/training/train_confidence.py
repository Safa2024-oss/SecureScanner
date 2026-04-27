import argparse
from pathlib import Path

from utils.config_loader import load_config
from utils.pipeline import run_text_classifier_training


def main():
    parser = argparse.ArgumentParser(description="Train confidence model (valid vulnerable finding).")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "confidence.json"))
    args = parser.parse_args()
    cfg = load_config(args.config)
    result = run_text_classifier_training(model_name="confidence", config=cfg)
    print(f"[INFO] confidence artifacts: {result.artifact_dir}")
    print(f"[INFO] confidence report: {result.report_dir}")


if __name__ == "__main__":
    main()

