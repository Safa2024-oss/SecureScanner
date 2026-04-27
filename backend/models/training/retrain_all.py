import subprocess
import sys
from pathlib import Path


TRAINERS = [
    "train_confidence.py",
    "train_risk.py",
    "train_severity.py",
    "train_vuln_type.py",
    "train_language.py",
]


def main():
    here = Path(__file__).resolve().parent
    for trainer in TRAINERS:
        path = here / trainer
        print(f"[INFO] Running {trainer}", flush=True)
        # -u ensures child trainer logs are streamed in real time.
        subprocess.check_call([sys.executable, "-u", str(path)])
    print("[INFO] All models trained successfully.", flush=True)


if __name__ == "__main__":
    main()

