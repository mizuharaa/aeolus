"""Initial schema — airports, aircraft, flights, crew, events, plans

Revision ID: 001
Revises:
Create Date: 2024-01-15 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "001"
down_revision: str | None = None
branch_labels: str | tuple | None = None
depends_on: str | tuple | None = None


def upgrade() -> None:
    # ── Enable extensions ───────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # ── airports ────────────────────────────────────────────────────────────
    op.create_table(
        "airports",
        sa.Column("id", sa.String(4), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("city", sa.String(64), nullable=False),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("hub_type", sa.String(16), nullable=False, server_default="spoke"),
        sa.Column("gates", sa.Integer, nullable=False, server_default="20"),
        sa.Column("runways", sa.Integer, nullable=False, server_default="2"),
        sa.Column("hourly_capacity", sa.Integer, nullable=False, server_default="60"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── aircraft ────────────────────────────────────────────────────────────
    op.create_table(
        "aircraft",
        sa.Column("id", sa.String(8), primary_key=True),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("base_airport_id", sa.String(4), sa.ForeignKey("airports.id"), nullable=False),
        sa.Column("seats", sa.Integer, nullable=False, server_default="150"),
        sa.Column("range_nm", sa.Integer, nullable=False, server_default="3000"),
        sa.Column("min_turn_minutes", sa.Integer, nullable=False, server_default="45"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_aircraft_base", "aircraft", ["base_airport_id"])

    # ── flights ─────────────────────────────────────────────────────────────
    op.create_table(
        "flights",
        sa.Column("id", sa.String(8), primary_key=True),
        sa.Column("aircraft_id", sa.String(8), sa.ForeignKey("aircraft.id"), nullable=False),
        sa.Column("origin_id", sa.String(4), sa.ForeignKey("airports.id"), nullable=False),
        sa.Column("destination_id", sa.String(4), sa.ForeignKey("airports.id"), nullable=False),
        sa.Column("scheduled_departure", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_arrival", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_departure", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("passengers", sa.Integer, nullable=False, server_default="120"),
        sa.Column("status", sa.String(16), nullable=False, server_default="scheduled"),
        sa.Column("delay_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_flights_aircraft", "flights", ["aircraft_id"])
    op.create_index("idx_flights_origin", "flights", ["origin_id"])
    op.create_index("idx_flights_destination", "flights", ["destination_id"])
    op.create_index("idx_flights_status", "flights", ["status"])
    op.create_index("idx_flights_departure", "flights", ["scheduled_departure"])
    op.execute("CREATE INDEX IF NOT EXISTS idx_flights_id_trgm ON flights USING gin(id gin_trgm_ops)")

    # ── crew_members ─────────────────────────────────────────────────────────
    op.create_table(
        "crew_members",
        sa.Column("id", sa.String(8), primary_key=True),
        sa.Column("role", sa.String(24), nullable=False),
        sa.Column("base_airport_id", sa.String(4), sa.ForeignKey("airports.id"), nullable=False),
        sa.Column("cert_types", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("employee_id", sa.String(16), nullable=True, unique=True),
        sa.Column("flight_hours_365d", sa.Integer, nullable=False, server_default="0"),
        sa.Column("flight_hours_28d", sa.Integer, nullable=False, server_default="0"),
        sa.Column("flight_hours_7d", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── crew_pairings ─────────────────────────────────────────────────────────
    op.create_table(
        "crew_pairings",
        sa.Column("id", sa.String(8), primary_key=True),
        sa.Column("flight_id", sa.String(8), sa.ForeignKey("flights.id"), nullable=False, unique=True),
        sa.Column("captain_id", sa.String(8), sa.ForeignKey("crew_members.id"), nullable=False),
        sa.Column("first_officer_id", sa.String(8), sa.ForeignKey("crew_members.id"), nullable=False),
        sa.Column("fa_ids", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("duty_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duty_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rest_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("flight_time_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="assigned"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_crew_pairings_flight", "crew_pairings", ["flight_id"])
    op.create_index("idx_crew_pairings_captain", "crew_pairings", ["captain_id"])

    # ── disruption_events ─────────────────────────────────────────────────────
    op.create_table(
        "disruption_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("params", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_disruption_events_kind", "disruption_events", ["kind"])
    op.create_index("idx_disruption_events_status", "disruption_events", ["status"])

    # ── recovery_plans ────────────────────────────────────────────────────────
    op.create_table(
        "recovery_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("disruption_events.id"), nullable=True),
        sa.Column("plan_id", sa.String(4), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="heuristic"),
        sa.Column("total_cost_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_passenger_delay_minutes", sa.Float, nullable=False, server_default="0"),
        sa.Column("cancelled_flights", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("delayed_flights", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("aircraft_swaps", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("crew_violations", sa.Integer, nullable=False, server_default="0"),
        sa.Column("solve_time_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── cascade_predictions (hypertable) ──────────────────────────────────────
    op.create_table(
        "cascade_predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("disruption_events.id"), nullable=True),
        sa.Column("flight_id", sa.String(8), sa.ForeignKey("flights.id"), nullable=True),
        sa.Column("cascade_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("predicted_delay_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cancel_probability", sa.Float, nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0"),
        sa.Column("features", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_cascade_flight", "cascade_predictions", ["flight_id"])
    op.execute("SELECT create_hypertable('cascade_predictions', 'created_at', if_not_exists => TRUE)")

    # ── flight_events (hypertable) ────────────────────────────────────────────
    op.create_table(
        "flight_events",
        sa.Column("time", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("flight_id", sa.String(8), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
    )
    op.create_index("idx_flight_events_flight", "flight_events", ["flight_id", "time"])
    op.execute("SELECT create_hypertable('flight_events', 'time', if_not_exists => TRUE)")

    # ── updated_at trigger ────────────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    for table in ["airports", "aircraft", "flights", "crew_members", "crew_pairings"]:
        op.execute(f"""
            CREATE TRIGGER trg_updated_at_{table}
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at()
        """)


def downgrade() -> None:
    # Drop in reverse dependency order
    for table in ["airports", "aircraft", "flights", "crew_members", "crew_pairings"]:
        op.execute(f"DROP TRIGGER IF EXISTS trg_updated_at_{table} ON {table}")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at()")

    op.drop_table("flight_events")
    op.drop_table("cascade_predictions")
    op.drop_table("recovery_plans")
    op.drop_table("disruption_events")
    op.drop_table("crew_pairings")
    op.drop_table("crew_members")
    op.drop_table("flights")
    op.drop_table("aircraft")
    op.drop_table("airports")
