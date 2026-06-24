from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )

    # App
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    log_level: str = "INFO"
    # Stored as the raw string from env (via CORS_ORIGINS) and exposed as a
    # parsed list through the ``cors_origins`` property below. This sidesteps
    # pydantic-settings' eager JSON decoding of list[str] fields.
    cors_origins_raw: str = Field(default="*", alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw.startswith("["):
            import json

            try:
                value = json.loads(raw)
                if isinstance(value, list):
                    return [str(x) for x in value]
            except json.JSONDecodeError:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    # Database
    database_url: str = "postgresql+asyncpg://aeolus:aeolus@localhost:5432/aeolus"
    database_url_sync: str = "postgresql://aeolus:aeolus@localhost:5432/aeolus"
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Streaming
    stream_backend: Literal["kafka", "redis_streams"] = "redis_streams"
    kafka_bootstrap_servers: str = "localhost:9092"

    # Optimizer
    solver_timeout_secs: int = 30
    use_heuristic_fallback: bool = True

    # Weather
    weather_fetch_interval_secs: int = 300

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # AWS
    aws_region: str = "us-east-1"
    s3_bucket: str = "aeolus-artifacts"
    s3_model_prefix: str = "models/"

    # Mapbox (for backend validation only)
    mapbox_token: str = ""

    # OpenSky Network — OAuth2 client credentials (preferred)
    # Create API client at https://opensky-network.org/my-opensky
    # Gives 5-second ADS-B resolution vs 10-second anonymous
    opensky_client_id: str = ""
    opensky_client_secret: str = ""
    # Legacy basic-auth (kept for fallback, OAuth2 takes priority)
    opensky_username: str = ""
    opensky_password: str = ""


settings = Settings()
