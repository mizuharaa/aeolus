"""
Structured logging configuration using structlog.
JSON format in production, pretty-printed in development.
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import EventDict, Processor

from src.core.config import settings


def _add_app_info(logger: Any, method: str, event_dict: EventDict) -> EventDict:
    """Add application-level metadata to every log record."""
    event_dict["app"] = "aeolus-api"
    event_dict["env"] = settings.app_env
    return event_dict


def _drop_color_message_key(logger: Any, method: str, event_dict: EventDict) -> EventDict:
    """Remove uvicorn's color_message key which clutters JSON logs."""
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging() -> None:
    """Configure structlog and stdlib logging to work together."""
    is_production = settings.app_env == "production"
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        _add_app_info,
        _drop_color_message_key,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
    ]

    if is_production:
        # JSON output for log aggregators (Loki, CloudWatch, etc.)
        structlog.configure(
            processors=shared_processors
            + [
                structlog.processors.dict_tracebacks,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(log_level),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Pretty console output for development
        structlog.configure(
            processors=shared_processors
            + [
                structlog.dev.ConsoleRenderer(colors=True),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(log_level),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )

    # Route stdlib logging through structlog
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.dev.ConsoleRenderer(colors=not is_production)
                if not is_production
                else structlog.processors.JSONRenderer(),
            ],
            foreign_pre_chain=shared_processors,
        )
    )

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Silence noisy libraries in production
    if is_production:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a bound structlog logger for a named module."""
    return structlog.get_logger(name)
