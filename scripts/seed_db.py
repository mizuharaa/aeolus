#!/usr/bin/env python3
"""
Seed the Aeolus PostgreSQL database from YAML files.

Usage:
    python scripts/seed_db.py [--drop-existing]

Environment:
    DATABASE_URL — PostgreSQL connection URL (asyncpg driver)
"""
from __future__ import annotations

import asyncio
import argparse
import logging
import sys
from pathlib import Path

import yaml
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from src.core.config import settings
from src.models.base import Base
from src.models.network import Airport, Aircraft, Flight, CrewMember, CrewPairing

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("seed_db")

DATA_DIR = Path(__file__).parent.parent / "data" / "network"


async def seed(drop_existing: bool = False) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        if drop_existing:
            log.warning("Dropping all tables...")
            await conn.run_sync(Base.metadata.drop_all)
        log.info("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # ── Airports ────────────────────────────────────────────────────────
        airports_yaml = yaml.safe_load((DATA_DIR / "airports.yaml").read_text())
        airports = airports_yaml.get("airports", [])
        log.info(f"Seeding {len(airports)} airports...")
        for a in airports:
            obj = Airport(
                id=a["id"],
                name=a["name"],
                city=a.get("city", ""),
                state=a.get("state", ""),
                lat=a["lat"],
                lon=a["lon"],
                timezone=a.get("timezone", "UTC"),
                hub_type=a.get("hub_type", "spoke"),
                gates=a.get("gates", 20),
                runways=a.get("runways", 2),
                hourly_capacity=a.get("hourly_capacity", 60),
            )
            await session.merge(obj)
        await session.commit()
        log.info("Airports seeded ✓")

        # ── Aircraft ─────────────────────────────────────────────────────────
        aircraft_yaml = yaml.safe_load((DATA_DIR / "aircraft.yaml").read_text())
        aircraft_list = aircraft_yaml.get("aircraft", [])
        log.info(f"Seeding {len(aircraft_list)} aircraft...")
        for ac in aircraft_list:
            obj = Aircraft(
                id=ac["id"],
                type=ac["type"],
                base_airport_id=ac["base_airport_id"],
                seats=ac.get("seats", 150),
                range_nm=ac.get("range_nm", 3000),
                min_turn_minutes=ac.get("min_turn_minutes", 45),
            )
            await session.merge(obj)
        await session.commit()
        log.info("Aircraft seeded ✓")

        # ── Flights ──────────────────────────────────────────────────────────
        flights_yaml = yaml.safe_load((DATA_DIR / "flights.yaml").read_text())
        flights = flights_yaml.get("flights", [])
        log.info(f"Seeding {len(flights)} flights...")
        for f in flights:
            obj = Flight(
                id=f["id"],
                aircraft_id=f["aircraft_id"],
                origin_id=f["origin"],
                destination_id=f["destination"],
                scheduled_departure=f["scheduled_departure"],
                scheduled_arrival=f["scheduled_arrival"],
                passengers=f.get("passengers", 120),
                status=f.get("status", "scheduled"),
                delay_minutes=f.get("delay_minutes", 0),
            )
            await session.merge(obj)
        await session.commit()
        log.info("Flights seeded ✓")

        # ── Crew Members ─────────────────────────────────────────────────────
        crews_yaml = yaml.safe_load((DATA_DIR / "crews.yaml").read_text())
        crew_members = crews_yaml.get("crew_members", [])
        log.info(f"Seeding {len(crew_members)} crew members...")
        for cm in crew_members:
            obj = CrewMember(
                id=cm["id"],
                role=cm["role"],
                base_airport_id=cm["base_airport_id"],
                cert_types=cm.get("cert_types", []),
            )
            await session.merge(obj)
        await session.commit()
        log.info("Crew members seeded ✓")

        # ── Crew Pairings ─────────────────────────────────────────────────────
        crew_pairings = crews_yaml.get("crew_pairings", [])
        log.info(f"Seeding {len(crew_pairings)} crew pairings...")
        for cp in crew_pairings:
            obj = CrewPairing(
                id=cp["id"],
                flight_id=cp["flight_id"],
                captain_id=cp["captain_id"],
                first_officer_id=cp["first_officer_id"],
                fa_ids=cp.get("fa_ids", []),
                duty_start=cp["duty_start"],
                duty_end=cp["duty_end"],
                flight_time_minutes=cp.get("flight_time_minutes", 0),
                status=cp.get("status", "assigned"),
            )
            await session.merge(obj)
        await session.commit()
        log.info("Crew pairings seeded ✓")

    await engine.dispose()
    log.info("Database seeded successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Aeolus database from YAML")
    parser.add_argument(
        "--drop-existing",
        action="store_true",
        help="Drop and recreate all tables before seeding",
    )
    args = parser.parse_args()
    asyncio.run(seed(drop_existing=args.drop_existing))


if __name__ == "__main__":
    main()
