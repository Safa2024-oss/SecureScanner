# SecureScanner ML Training System

This directory contains the production-oriented local ML training pipeline for SecureScanner.

## Architecture

- `datasets/raw/`: source CSV files used for training.
- `datasets/processed/`: optional preprocessed snapshots for repeatability.
- `datasets/manifests/`: generated dataset manifests (hash, schema, row count).
- `configs/`: per-model JSON training configs.
- `training/`: trainers and shared utilities.
- `artifacts/{confidence,risk,severity,vuln_type,language}/`: deployable model artifacts.
- `reports/`: timestamped run reports with metrics and metadata.

## Models and Purpose

- `confidence`: predicts vulnerability confidence (`vulnerable` likelihood).
- `risk`: predicts `Low/Medium/High/Critical` risk levels.
- `severity`: predicts severity class.
- `vuln_type`: predicts vulnerability category.
- `language`: predicts programming language (if labels exist).

## Data Rules and Leakage Policy

- Required columns are validated before training.
- Rows with null target/text are dropped.
- Duplicate rows are removed by text/target subset.
- Text fields that look like remediation/fix outputs are blocked by leakage guards.
- Every run writes a dataset manifest with SHA256 hash.

## Training Commands

Run from `backend/models/training`:

- `python train_confidence.py`
- `python train_risk.py`
- `python train_severity.py`
- `python train_vuln_type.py`
- `python train_language.py`
- `python retrain_all.py`

You can pass custom config path:

- `python train_confidence.py --config ../configs/confidence.json`

## Output Artifacts

For each run, a timestamped folder is created under `reports/` containing:

- `metrics.json`
- `classification_report.json`
- `confusion_matrix.csv`
- `threshold_recommendations.json`
- `error_analysis.csv`
- `class_distribution.json`
- `metadata.json`

Model deploy artifacts are written under `artifacts/<model_name>/`:

- `model.joblib`
- `vectorizer.joblib` (if needed)
- `threshold_recommendations.json`

## Metadata Contract

Each run emits `metadata.json` with:

- model identity/version
- dataset name/hash
- feature and target columns
- split ratios
- hyperparameters
- metrics summary
- threshold recommendations
- known limitations
- git commit (best effort)

## Threshold and Manual Review Policy

- Inference reads per-model thresholds from artifact folder.
- Confidence buckets:
  - `high`
  - `medium`
  - `low`
  - `needs_manual_review`
- Findings under `manual_review_below` should be treated as review-required.

## Retraining Workflow (Step by Step)

1. Place latest datasets in `datasets/raw/`.
2. Verify config paths and target/text columns in `configs/*.json`.
3. Run `python retrain_all.py`.
4. Inspect newest folders in `reports/` for metrics and error analysis.
5. Validate threshold recommendations and class-wise metrics.
6. Commit artifacts and reports after review.
7. Deploy backend with updated artifacts.

## Security Considerations

- Only load artifacts from trusted repository paths.
- Validate dataset sources before training.
- Keep model artifacts in version control with review.
- Do not execute untrusted pickle/joblib files from external uploads.

## Future Roadmap (Not Yet Implemented)

- Artifact signature verification.
- Calibration curves and threshold optimization by business SLA.
- Drift monitoring and scheduled retraining orchestration.
- Rollback registry and A/B inference routing.

