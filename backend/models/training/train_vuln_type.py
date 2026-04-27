import argparse
from pathlib import Path

from utils.config_loader import load_config
from utils.pipeline import run_text_classifier_training


def main():
    parser = argparse.ArgumentParser(description="Train vulnerability type model.")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "vuln_type.json"))
    args = parser.parse_args()
    cfg = load_config(args.config)
    result = run_text_classifier_training(model_name="vuln_type", config=cfg)
    print(f"[INFO] vuln_type artifacts: {result.artifact_dir}")
    print(f"[INFO] vuln_type report: {result.report_dir}")


if __name__ == "__main__":
    main()

