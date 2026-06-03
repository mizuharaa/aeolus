# Build context is the repo root (docker-compose context: .)
# so all COPY paths are relative to the repo root.

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM python:3.11-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==1.8.0

COPY apps/api/pyproject.toml apps/api/poetry.lock* ./apps/api/

WORKDIR /app/apps/api
RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-interaction --no-ansi --no-root

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM python:3.11-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Preserve directory hierarchy so DATA_DIR path resolution works:
# Path(__file__).parent × 4 = /app → /app/data/network
COPY apps/api/src/ ./apps/api/src/
COPY data/ ./data/

RUN useradd -m -u 1001 aeolus && chown -R aeolus:aeolus /app
USER aeolus

WORKDIR /app/apps/api

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Bind to the platform-provided $PORT (Railway, etc.); default to 8000 locally.
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
