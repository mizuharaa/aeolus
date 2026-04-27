#!/usr/bin/env python3
"""
Train the Aeolus cascade disruption predictor (XGBoost).

Generates synthetic training data from the YAML network, trains two models:
  - delay_regressor:   predict delay_minutes given disruption features
  - cancel_classifier: predict cancel_probability given disruption features

Usage:
    python scripts/train_predictor.py [--n-samples N] [--output-dir DIR]

Output:
    models/delay_regressor.json
    models/cancel_classifier.json
    models/feature_columns.json
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import yaml

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("train_predictor")

DATA_DIR = Path(__file__).parent.parent / "data" / "network"
SCENARIO_DIR = Path(__file__).parent.parent / "data" / "scenarios"


def load_network() -> tuple[list, list, list]:
    airports = yaml.safe_load((DATA_DIR / "airports.yaml").read_text())["airports"]
    aircraft = yaml.safe_load((DATA_DIR / "aircraft.yaml").read_text())["aircraft"]
    flights  = yaml.safe_load((DATA_DIR / "flights.yaml").read_text())["flights"]
    return airports, aircraft, flights


def flight_features(flight: dict, aircraft_map: dict, airport_map: dict) -> dict:
    """Extract per-flight static features."""
    ac = aircraft_map.get(flight["aircraft_id"], {})
    origin = airport_map.get(flight.get("origin", flight.get("origin_id", "")), {})
    dest   = airport_map.get(flight.get("destination", flight.get("destination_id", "")), {})

    dep = flight["scheduled_departure"]
    if isinstance(dep, str):
        from datetime import datetime, timezone
        dep = datetime.fromisoformat(dep.replace("Z", "+00:00"))

    return {
        "dep_hour_utc":          dep.hour,
        "dep_day_of_week":       dep.weekday(),
        "seats":                 ac.get("seats", 150),
        "range_nm":              ac.get("range_nm", 3000),
        "origin_hourly_cap":     origin.get("hourly_capacity", 60),
        "dest_hourly_cap":       dest.get("hourly_capacity", 60),
        "origin_runways":        origin.get("runways", 2),
        "dest_runways":          dest.get("runways", 2),
        "passengers":            flight.get("passengers", 120),
        "is_hub_origin":         1 if origin.get("hub_type") == "hub" else 0,
        "is_hub_dest":           1 if dest.get("hub_type") == "hub" else 0,
    }


def generate_training_data(
    flights: list,
    aircraft_map: dict,
    airport_map: dict,
    n_samples: int,
    rng: np.random.Generator,
) -> tuple[list, list, list]:
    """
    Synthetically generate labeled training examples by simulating disruption scenarios.
    Each sample is: (features_dict, delay_minutes_label, cancel_probability_label)
    """
    # Event severity multipliers by kind
    severity_map = {
        "weather_closure": (0.9, 0.35),
        "ground_stop":     (0.85, 0.20),
        "airspace_closure": (0.5, 0.05),
        "security_event":  (0.7, 0.18),
        "mechanical_aog":  (0.6, 0.30),
        "crew_sickout":    (0.65, 0.40),
        "runway_closure":  (0.4, 0.08),
        "atc_staffing":    (0.45, 0.06),
        "volcanic_ash":    (0.95, 0.55),
        "cyber_incident":  (0.3, 0.03),
    }
    event_kinds = list(severity_map.keys())

    X, y_delay, y_cancel = [], [], []

    for _ in range(n_samples):
        flight = rng.choice(flights)
        ffeats = flight_features(flight, aircraft_map, airport_map)

        # Random disruption scenario
        kind = rng.choice(event_kinds)
        delay_mult, cancel_base = severity_map[kind]
        severity = rng.uniform(0.2, 1.0)
        cascade_order = rng.integers(0, 3)  # 0=direct, 1=first-hop, 2=second-hop

        # Base delay: 30–360 minutes, scaled by severity and cascade order
        base_delay = rng.uniform(30, 360) * severity * delay_mult
        cascade_decay = 0.6 ** cascade_order  # delay attenuates each hop
        delay_minutes = base_delay * cascade_decay + rng.normal(0, 15)
        delay_minutes = max(0, delay_minutes)

        # Cancel probability: higher for direct disruptions, attenuates at hops
        cancel_prob = cancel_base * severity * (cascade_decay * 0.8 + 0.2)
        # Flights at saturated hubs more likely to cancel
        if ffeats["origin_hourly_cap"] < 40:
            cancel_prob *= 1.3
        cancel_prob = float(np.clip(cancel_prob, 0.0, 0.99))

        # Build feature vector
        kind_dummies = {f"kind_{k}": int(k == kind) for k in event_kinds}
        features = {
            **ffeats,
            **kind_dummies,
            "severity":      severity,
            "cascade_order": cascade_order,
        }
        X.append(features)
        y_delay.append(float(delay_minutes))
        y_cancel.append(cancel_prob)

    return X, y_delay, y_cancel


def train(n_samples: int, output_dir: Path) -> None:
    try:
        import xgboost as xgb
    except ImportError:
        log.error("xgboost not installed. Run: pip install xgboost")
        sys.exit(1)

    log.info(f"Loading network data from {DATA_DIR}...")
    airports, aircraft, flights = load_network()
    aircraft_map = {a["id"]: a for a in aircraft}
    airport_map  = {a["id"]: a for a in airports}

    log.info(f"Generating {n_samples} synthetic training samples...")
    rng = np.random.default_rng(seed=42)
    X, y_delay, y_cancel = generate_training_data(flights, aircraft_map, airport_map, n_samples, rng)

    # Convert to numpy arrays
    feature_columns = list(X[0].keys())
    X_arr = np.array([[row[c] for c in feature_columns] for row in X], dtype=np.float32)
    y_delay_arr  = np.array(y_delay,  dtype=np.float32)
    y_cancel_arr = np.array(y_cancel, dtype=np.float32)

    log.info(f"Feature matrix: {X_arr.shape} | delay range: [{y_delay_arr.min():.1f}, {y_delay_arr.max():.1f}]")

    # ── Train delay regressor ────────────────────────────────────────────────
    log.info("Training delay regressor (XGBRegressor)...")
    reg = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        eval_metric="rmse",
    )
    reg.fit(
        X_arr, y_delay_arr,
        eval_set=[(X_arr, y_delay_arr)],
        verbose=False,
    )
    reg_path = output_dir / "delay_regressor.json"
    reg.save_model(str(reg_path))
    log.info(f"Delay regressor saved → {reg_path}")

    # ── Train cancel classifier ───────────────────────────────────────────────
    log.info("Training cancel classifier (XGBRegressor for probabilities)...")
    clf = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        eval_metric="rmse",
        # Output will be clipped to [0,1] at inference time
    )
    clf.fit(
        X_arr, y_cancel_arr,
        eval_set=[(X_arr, y_cancel_arr)],
        verbose=False,
    )
    clf_path = output_dir / "cancel_classifier.json"
    clf.save_model(str(clf_path))
    log.info(f"Cancel classifier saved → {clf_path}")

    # ── Save feature columns for inference ───────────────────────────────────
    feat_path = output_dir / "feature_columns.json"
    feat_path.write_text(json.dumps(feature_columns, indent=2))
    log.info(f"Feature columns saved → {feat_path}")

    # ── Quick evaluation ─────────────────────────────────────────────────────
    delay_preds  = reg.predict(X_arr)
    cancel_preds = clf.predict(X_arr)
    delay_rmse   = float(np.sqrt(np.mean((delay_preds - y_delay_arr) ** 2)))
    cancel_rmse  = float(np.sqrt(np.mean((cancel_preds - y_cancel_arr) ** 2)))
    log.info(f"Training RMSE — delay: {delay_rmse:.2f} min | cancel_prob: {cancel_rmse:.4f}")
    log.info("Training complete ✓")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Aeolus cascade predictor")
    parser.add_argument("--n-samples", type=int, default=50_000, help="Training sample count")
    parser.add_argument("--output-dir", type=str, default="models", help="Model output directory")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    train(n_samples=args.n_samples, output_dir=output_dir)


if __name__ == "__main__":
    main()
