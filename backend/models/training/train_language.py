import argparse
from pathlib import Path

from utils.config_loader import load_config
from utils.pipeline import run_text_classifier_training


def main():
    parser = argparse.ArgumentParser(description="Train language classifier.")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "language.json"))
    args = parser.parse_args()
    cfg = load_config(args.config)
    result = run_text_classifier_training(model_name="language", config=cfg)
    print(f"[INFO] language artifacts: {result.artifact_dir}")
    print(f"[INFO] language report: {result.report_dir}")


if __name__ == "__main__":
    main()

