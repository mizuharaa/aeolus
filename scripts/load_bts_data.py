#!/usr/bin/env python3
"""
Load BTS (Bureau of Transportation Statistics) on-time performance data
into the Aeolus database to supplement synthetic training data.

Downloads data from BTS TRANSTATS (https://www.transtats.bts.gov/) and
filters for Nimbus Air network airports and routes.

Usage:
    python scripts/load_bts_data.py --year 2023 --months 1,2,3
    python scripts/load_bts_data.py --csv-path /path/to/on_time_reporting.csv

BTS file schema expected columns:
    FlightDate, Reporting_Airline, IATA_Code_Operating_Airline,
    Origin, Dest, CRSDepTime, CRSArrTime, DepDelay, ArrDelay,
    Cancelled, Diverted, ActualElapsedTime, Flights
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import io
import logging
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from urllib.request import urlretrieve

import yaml

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("load_bts")

DATA_DIR   = Path(__file__).parent.parent / "data" / "network"
CACHE_DIR  = Path(__file__).parent.parent / "data" / "bts_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Nimbus Air network airports (ICAO → IATA mapping)
ICAO_TO_IATA = {
    "KORD": "ORD", "KATL": "ATL", "KDFW": "DFW", "KLAX": "LAX",
    "KDEN": "DEN", "KJFK": "JFK", "KSEA": "SEA", "KMIA": "MIA",
    "KPHX": "PHX", "KLAS": "LAS", "KBOS": "BOS", "KSFO": "SFO",
    "KIAH": "IAH", "KDTW": "DTW", "KMSP": "MSP",
}
IATA_TO_ICAO = {v: k for k, v in ICAO_TO_IATA.items()}
NETWORK_IATA = set(ICAO_TO_IATA.values())

BTS_BASE_URL = "https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{year}_{month}.zip"


def bts_url(year: int, month: int) -> str:
    return BTS_BASE_URL.format(year=year, month=month)


def download_bts_file(year: int, month: int) -> Path:
    """Download and cache BTS ZIP file for a given year/month."""
    cache_path = CACHE_DIR / f"bts_{year}_{month:02d}.zip"
    if cache_path.exists():
        log.info(f"Using cached {cache_path.name}")
        return cache_path
    url = bts_url(year, month)
    log.info(f"Downloading {url}...")
    urlretrieve(url, cache_path)
    log.info(f"Downloaded → {cache_path}")
    return cache_path


def parse_bts_zip(zip_path: Path) -> Iterator[dict]:
    """Parse rows from BTS ZIP, filtering for network airports."""
    with zipfile.ZipFile(zip_path) as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csv_names:
            log.warning(f"No CSV found in {zip_path}")
            return
        with zf.open(csv_names[0]) as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="replace"))
            for row in reader:
                origin = row.get("Origin", "").strip()
                dest   = row.get("Dest", "").strip()
                if origin not in NETWORK_IATA or dest not in NETWORK_IATA:
                    continue
                yield row


def parse_bts_csv(csv_path: Path) -> Iterator[dict]:
    """Parse rows from a local BTS CSV file."""
    with open(csv_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            origin = row.get("Origin", "").strip()
            dest   = row.get("Dest", "").strip()
            if origin not in NETWORK_IATA or dest not in NETWORK_IATA:
                continue
            yield row


def row_to_flight_event(row: dict) -> dict | None:
    """Convert a BTS row to a flight_event record."""
    try:
        flight_date = row.get("FlightDate", "").strip()
        origin      = IATA_TO_ICAO.get(row.get("Origin", "").strip())
        dest        = IATA_TO_ICAO.get(row.get("Dest", "").strip())
        if not all([flight_date, origin, dest]):
            return None

        dep_delay   = float(row.get("DepDelay", 0) or 0)
        arr_delay   = float(row.get("ArrDelay", 0) or 0)
        cancelled   = int(float(row.get("Cancelled", 0) or 0))
        diverted    = int(float(row.get("Diverted", 0) or 0))

        status = "scheduled"
        if cancelled:
            status = "cancelled"
        elif diverted:
            status = "diverted"
        elif dep_delay > 15 or arr_delay > 15:
            status = "delayed"

        return {
            "flight_date":  flight_date,
            "origin_iata":  row.get("Origin", "").strip(),
            "dest_iata":    row.get("Dest", "").strip(),
            "origin_icao":  origin,
            "dest_icao":    dest,
            "carrier":      row.get("Reporting_Airline", "").strip(),
            "dep_delay":    dep_delay,
            "arr_delay":    arr_delay,
            "cancelled":    cancelled,
            "diverted":     diverted,
            "status":       status,
            "elapsed_min":  float(row.get("ActualElapsedTime", 0) or 0),
        }
    except (ValueError, TypeError) as e:
        log.debug(f"Skipping malformed row: {e}")
        return None


def write_training_features(events: list[dict], output_path: Path) -> None:
    """Write extracted training features to JSONL for predictor training."""
    import json
    count = 0
    with open(output_path, "w") as f:
        for ev in events:
            record = {
                "origin":      ev["origin_icao"],
                "destination": ev["dest_icao"],
                "dep_delay":   ev["dep_delay"],
                "cancelled":   ev["cancelled"],
                "status":      ev["status"],
                "elapsed_min": ev["elapsed_min"],
            }
            f.write(json.dumps(record) + "\n")
            count += 1
    log.info(f"Wrote {count} training records → {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load BTS on-time data")
    parser.add_argument("--year", type=int, default=2023, help="Year to download")
    parser.add_argument("--months", type=str, default="1,2,3",
                        help="Comma-separated months (e.g. 1,2,3)")
    parser.add_argument("--csv-path", type=str, default=None,
                        help="Path to pre-downloaded BTS CSV (skips download)")
    parser.add_argument("--output", type=str,
                        default=str(CACHE_DIR / "bts_features.jsonl"),
                        help="Output JSONL path for training features")
    args = parser.parse_args()

    all_events: list[dict] = []

    if args.csv_path:
        csv_path = Path(args.csv_path)
        log.info(f"Parsing local CSV: {csv_path}")
        for row in parse_bts_csv(csv_path):
            ev = row_to_flight_event(row)
            if ev:
                all_events.append(ev)
    else:
        months = [int(m.strip()) for m in args.months.split(",")]
        for month in months:
            log.info(f"Processing {args.year}-{month:02d}...")
            try:
                zip_path = download_bts_file(args.year, month)
                for row in parse_bts_zip(zip_path):
                    ev = row_to_flight_event(row)
                    if ev:
                        all_events.append(ev)
            except Exception as e:
                log.warning(f"Failed to process {args.year}-{month:02d}: {e}")

    log.info(f"Total events collected: {len(all_events)}")

    # Summary stats
    cancelled = sum(1 for e in all_events if e["cancelled"])
    delayed   = sum(1 for e in all_events if e["status"] == "delayed")
    log.info(f"  Cancelled: {cancelled} ({cancelled/max(len(all_events),1)*100:.1f}%)")
    log.info(f"  Delayed:   {delayed}   ({delayed/max(len(all_events),1)*100:.1f}%)")

    if all_events:
        write_training_features(all_events, Path(args.output))

    log.info("Done.")


if __name__ == "__main__":
    main()
