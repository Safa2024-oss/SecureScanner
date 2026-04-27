from dataclasses import dataclass
import json
from pathlib import Path
from typing import Callable

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from .repro import set_global_seed
from .paths import get_artifact_dir, get_report_run_dir
from .data_contracts import (
    load_dataset,
    validate_columns,
    clean_rows,
    enforce_leakage_guards,
    write_dataset_manifest,
)
from .evaluation import save_eval_outputs, recommend_thresholds
from .artifacts import save_model_artifacts, write_metadata


@dataclass
class TrainingResult:
    artifact_dir: Path
    report_dir: Path
    metrics: dict


def _log(model_name: str, message: str) -> None:
    print(f"[TRAIN][{model_name}] {message}", flush=True)


def run_text_classifier_training(
    *,
    model_name: str,
    config: dict,
    label_builder: Callable | None = None,
) -> TrainingResult:
    _log(model_name, "Starting training run")
    set_global_seed(config["seed"])
    _log(model_name, f"Seed set to {config['seed']}")

    dataset_path = config["dataset"]["path"]
    text_col = config["dataset"]["text_column"]
    target_col = config["dataset"]["target_column"]

    _log(model_name, f"Loading dataset from {dataset_path}")
    df = load_dataset(dataset_path)
    _log(model_name, f"Loaded {len(df)} raw rows")
    validate_columns(df, [text_col, target_col])
    _log(model_name, f"Validated required columns: {text_col}, {target_col}")
    enforce_leakage_guards(text_col)
    _log(model_name, f"Leakage guard passed for text column: {text_col}")
    df = clean_rows(df, required_non_null=[text_col, target_col], dedup_subset=[text_col, target_col])
    _log(model_name, f"Rows after cleaning/deduplication: {len(df)}")

    if label_builder is not None:
        y = label_builder(df)
    else:
        y = df[target_col].astype(str)
    X = df[text_col].astype(str)

    manifest = write_dataset_manifest(dataset_path, df, model_name)
    _log(model_name, f"Dataset manifest written: {manifest['dataset_name']} ({manifest['row_count']} rows)")

    _log(model_name, "Creating train/val/test splits")
    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X,
        y,
        test_size=config["splits"]["test_size"],
        random_state=config["seed"],
        stratify=y if config["splits"].get("stratify", True) else None,
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_full,
        y_train_full,
        test_size=config["splits"]["val_size"],
        random_state=config["seed"],
        stratify=y_train_full if config["splits"].get("stratify", True) else None,
    )
    _log(
        model_name,
        f"Split sizes -> train: {len(X_train)}, val: {len(X_val)}, test: {len(X_test)}",
    )

    vec_cfg = config["vectorizer"]
    _log(model_name, f"Building TF-IDF vectorizer with config: {vec_cfg}")
    vectorizer = TfidfVectorizer(
        max_features=vec_cfg.get("max_features", 10000),
        ngram_range=tuple(vec_cfg.get("ngram_range", [1, 1])),
        min_df=vec_cfg.get("min_df", 1),
        max_df=vec_cfg.get("max_df", 1.0),
    )
    _log(model_name, "Fitting vectorizer on training set")
    X_train_v = vectorizer.fit_transform(X_train)
    _log(model_name, "Transforming validation and test sets")
    X_val_v = vectorizer.transform(X_val)
    X_test_v = vectorizer.transform(X_test)

    mdl_cfg = config["model"]
    _log(model_name, f"Initializing LogisticRegression with config: {mdl_cfg}")
    model = LogisticRegression(
        max_iter=mdl_cfg.get("max_iter", 1000),
        class_weight=mdl_cfg.get("class_weight", None),
        C=mdl_cfg.get("C", 1.0),
        random_state=config["seed"],
    )
    _log(model_name, "Training model")
    model.fit(X_train_v, y_train)
    _log(model_name, "Model training finished")

    _log(model_name, "Running validation predictions for threshold recommendations")
    y_val_pred = model.predict(X_val_v)
    y_val_proba = model.predict_proba(X_val_v)
    thresholds = recommend_thresholds(y_val, y_val_proba)
    _log(model_name, f"Recommended thresholds: {thresholds}")

    _log(model_name, "Running test evaluation")
    y_test_pred = model.predict(X_test_v)
    y_test_proba = model.predict_proba(X_test_v)
    labels = sorted(list(set(y.astype(str))))

    artifact_dir = get_artifact_dir(model_name)
    report_dir = get_report_run_dir(model_name)
    metrics = save_eval_outputs(
        report_dir=report_dir,
        labels=labels,
        y_true=list(y_test),
        y_pred=list(y_test_pred),
        y_pred_proba=y_test_proba,
        sample_texts=list(X_test),
        thresholds=thresholds,
    )
    _log(model_name, f"Evaluation outputs written to {report_dir}")
    _log(model_name, f"Key metrics: accuracy={metrics.get('accuracy', 0):.4f}, f1_macro={metrics.get('f1_macro', 0):.4f}")

    _log(model_name, f"Saving model artifacts to {artifact_dir}")
    save_model_artifacts(
        artifact_dir=artifact_dir,
        model=model,
        vectorizer=vectorizer,
        model_filename="model.joblib",
        vectorizer_filename="vectorizer.joblib",
    )
    with (artifact_dir / "threshold_recommendations.json").open("w", encoding="utf-8") as f:
        json.dump(thresholds, f, indent=2)
    _log(model_name, "Threshold recommendations saved in artifact directory")

    _log(model_name, "Writing training metadata")
    write_metadata(
        report_dir=report_dir,
        metadata={
            "model_name": model_name,
            "model_version": config["model_version"],
            "dataset_name": manifest["dataset_name"],
            "dataset_hash": manifest["dataset_hash"],
            "feature_columns": [text_col],
            "target_column": target_col,
            "split_ratios": config["splits"],
            "hyperparameters": {
                "vectorizer": vec_cfg,
                "model": mdl_cfg,
            },
            "metrics_summary": metrics,
            "threshold_recommendations": thresholds,
            "known_limitations": config.get("known_limitations", []),
        },
    )
    _log(model_name, "Training run completed successfully")

    return TrainingResult(artifact_dir=artifact_dir, report_dir=report_dir, metrics=metrics)

