-- ============================================================
-- Aeolus — PostgreSQL 16 + TimescaleDB initialization
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for fuzzy text search on flight IDs

-- ─── Schema ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airports (
    id              VARCHAR(4)  PRIMARY KEY,  -- ICAO code
    name            VARCHAR(128) NOT NULL,
    city            VARCHAR(64)  NOT NULL,
    state           VARCHAR(32)  NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    timezone        VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    hub_type        VARCHAR(16)  NOT NULL DEFAULT 'spoke',
    gates           INTEGER      NOT NULL DEFAULT 20,
    runways         INTEGER      NOT NULL DEFAULT 2,
    hourly_capacity INTEGER      NOT NULL DEFAULT 60,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aircraft (
    id               VARCHAR(8)  PRIMARY KEY,  -- tail number e.g. N001NB
    type             VARCHAR(16) NOT NULL,
    base_airport_id  VARCHAR(4)  NOT NULL REFERENCES airports(id),
    seats            INTEGER     NOT NULL DEFAULT 150,
    range_nm         INTEGER     NOT NULL DEFAULT 3000,
    min_turn_minutes INTEGER     NOT NULL DEFAULT 45,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flights (
    id                   VARCHAR(8)   PRIMARY KEY,  -- e.g. NB101
    aircraft_id          VARCHAR(8)   NOT NULL REFERENCES aircraft(id),
    origin_id            VARCHAR(4)   NOT NULL REFERENCES airports(id),
    destination_id       VARCHAR(4)   NOT NULL REFERENCES airports(id),
    scheduled_departure  TIMESTAMPTZ  NOT NULL,
    scheduled_arrival    TIMESTAMPTZ  NOT NULL,
    actual_departure     TIMESTAMPTZ,
    actual_arrival       TIMESTAMPTZ,
    passengers           INTEGER      NOT NULL DEFAULT 120,
    status               VARCHAR(16)  NOT NULL DEFAULT 'scheduled',  -- scheduled|delayed|cancelled|diverted
    delay_minutes        INTEGER      NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crew_members (
    id               VARCHAR(8)   PRIMARY KEY,  -- e.g. CA01
    role             VARCHAR(24)  NOT NULL,     -- captain|first_officer|flight_attendant
    base_airport_id  VARCHAR(4)   NOT NULL REFERENCES airports(id),
    cert_types       JSONB        NOT NULL DEFAULT '[]',
    employee_id      VARCHAR(16)  UNIQUE,
    flight_hours_365d INTEGER     NOT NULL DEFAULT 0,
    flight_hours_28d  INTEGER     NOT NULL DEFAULT 0,
    flight_hours_7d   INTEGER     NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crew_pairings (
    id                   VARCHAR(8)   PRIMARY KEY,  -- e.g. CP001
    flight_id            VARCHAR(8)   NOT NULL UNIQUE REFERENCES flights(id),
    captain_id           VARCHAR(8)   NOT NULL REFERENCES crew_members(id),
    first_officer_id     VARCHAR(8)   NOT NULL REFERENCES crew_members(id),
    fa_ids               JSONB        NOT NULL DEFAULT '[]',
    duty_start           TIMESTAMPTZ  NOT NULL,
    duty_end             TIMESTAMPTZ  NOT NULL,
    rest_start           TIMESTAMPTZ,
    flight_time_minutes  INTEGER      NOT NULL DEFAULT 0,
    status               VARCHAR(16)  NOT NULL DEFAULT 'assigned',  -- assigned|illegal|open
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Disruption Events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disruption_events (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind        VARCHAR(32) NOT NULL,
    params      JSONB       NOT NULL DEFAULT '{}',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMPTZ,
    status       VARCHAR(16) NOT NULL DEFAULT 'active',  -- active|resolved|expired
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Recovery Plans ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recovery_plans (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id                    UUID        REFERENCES disruption_events(id),
    plan_id                     VARCHAR(4)  NOT NULL,  -- A|B|C
    status                      VARCHAR(16) NOT NULL DEFAULT 'heuristic',
    total_cost_usd              DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_passenger_delay_minutes DOUBLE PRECISION NOT NULL DEFAULT 0,
    cancelled_flights           JSONB       NOT NULL DEFAULT '[]',
    delayed_flights             JSONB       NOT NULL DEFAULT '[]',
    aircraft_swaps              JSONB       NOT NULL DEFAULT '[]',
    crew_violations             INTEGER     NOT NULL DEFAULT 0,
    solve_time_ms               INTEGER     NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Cascade Predictions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cascade_predictions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID        REFERENCES disruption_events(id),
    flight_id       VARCHAR(8)  REFERENCES flights(id),
    cascade_order   INTEGER     NOT NULL DEFAULT 0,  -- 0=direct, 1=first-hop, 2=second-hop
    predicted_delay_minutes INTEGER NOT NULL DEFAULT 0,
    cancel_probability DOUBLE PRECISION NOT NULL DEFAULT 0,
    confidence      DOUBLE PRECISION NOT NULL DEFAULT 0,
    features        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert cascade_predictions to hypertable for time-series queries
SELECT create_hypertable('cascade_predictions', 'created_at', if_not_exists => TRUE);

-- ─── Flight Events Log (time-series) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flight_events (
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    flight_id   VARCHAR(8)  NOT NULL,
    event_type  VARCHAR(32) NOT NULL,  -- status_change|delay_update|cancellation|diversion
    old_value   TEXT,
    new_value   TEXT,
    event_id    UUID        REFERENCES disruption_events(id),
    metadata    JSONB       NOT NULL DEFAULT '{}'
);

SELECT create_hypertable('flight_events', 'time', if_not_exists => TRUE);

-- ─── WebSocket Sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ws_sessions (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ping   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subscriptions JSONB     NOT NULL DEFAULT '[]'
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_flights_aircraft        ON flights(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flights_origin          ON flights(origin_id);
CREATE INDEX IF NOT EXISTS idx_flights_destination     ON flights(destination_id);
CREATE INDEX IF NOT EXISTS idx_flights_status          ON flights(status);
CREATE INDEX IF NOT EXISTS idx_flights_departure       ON flights(scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_crew_pairings_flight    ON crew_pairings(flight_id);
CREATE INDEX IF NOT EXISTS idx_crew_pairings_captain   ON crew_pairings(captain_id);
CREATE INDEX IF NOT EXISTS idx_disruption_events_kind  ON disruption_events(kind);
CREATE INDEX IF NOT EXISTS idx_disruption_events_status ON disruption_events(status);
CREATE INDEX IF NOT EXISTS idx_cascade_flight          ON cascade_predictions(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_events_flight    ON flight_events(flight_id, time DESC);

-- Trigram index for fuzzy flight ID search
CREATE INDEX IF NOT EXISTS idx_flights_id_trgm ON flights USING gin(id gin_trgm_ops);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['airports','aircraft','flights','crew_members','crew_pairings']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_updated_at_%s
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
            t, t
        );
    END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ─── Seed roles / grants ──────────────────────────────────────────────────────

-- The app user (set via POSTGRES_USER in docker-compose) gets all needed perms.
-- In production, create a read-only analytics role:
-- CREATE ROLE aeolus_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO aeolus_readonly;
