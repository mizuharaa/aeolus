"""
Ask Aeolus — the grounded dispatcher copilot.

POST /agent/ask takes a plain-language question, snapshots the live engine
state (active events, cascade summary, recovery plans, fleet status), and
asks Gemini to answer AS the OCC copilot, grounded in those numbers. The
model never sees anything it could hallucinate a schedule from — every
figure in the context block comes from the deterministic engine.

Rate limiting: an in-process token bucket per client IP. Free, zero infra,
and enough for a single-process MVP deployment.
# ponytail: app-level limiter; put Cloudflare (free tier) in front when public
"""

from __future__ import annotations

import logging
import time

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# ── Token bucket per client IP ────────────────────────────────────────────
# refill agent_rate_per_min tokens/min, burst capacity agent_burst.
# Single dict + monotonic clock; entries idle >10 min are pruned lazily.

_buckets: dict[str, tuple[float, float]] = {}  # ip -> (tokens, last_refill_ts)


def _take_token(ip: str) -> tuple[bool, float]:
    """Try to take one token for `ip`. Returns (allowed, retry_after_secs)."""
    now = time.monotonic()
    rate = settings.agent_rate_per_min / 60.0  # tokens per second
    cap = float(settings.agent_burst)

    tokens, last = _buckets.get(ip, (cap, now))
    tokens = min(cap, tokens + (now - last) * rate)

    if tokens >= 1.0:
        _buckets[ip] = (tokens - 1.0, now)
        return True, 0.0
    _buckets[ip] = (tokens, now)
    retry_after = (1.0 - tokens) / rate

    # lazy prune so the dict can't grow unbounded under an IP-rotating flood
    if len(_buckets) > 10_000:
        cutoff = now - 600
        for k in [k for k, (_, ts) in _buckets.items() if ts < cutoff]:
            _buckets.pop(k, None)

    return False, retry_after


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Grounded context ──────────────────────────────────────────────────────


def _fmt_usd(v: float | int | None) -> str:
    if not v:
        return "$0"
    v = float(v)
    return f"${v / 1e6:.2f}M" if v >= 1e6 else f"${v / 1e3:.0f}k"


def _engine_context(engine) -> str:
    """Condense the live engine state into a compact, citable context block."""
    st = engine.state
    lines: list[str] = []

    # fleet status
    statuses = [s.get("status", "scheduled") for s in st.flight_states.values()]
    delays = [s.get("delay_minutes", 0) for s in st.flight_states.values()]
    lines.append(
        f"FLEET: {len(engine.schedule)} scheduled legs · "
        f"{statuses.count('scheduled')} on time · {statuses.count('delayed')} delayed · "
        f"{statuses.count('cancelled')} cancelled · total delay {sum(delays)} min"
    )

    # active events
    if st.active_events:
        for e in st.active_events:
            p = e.get("params", {})
            loc = (
                p.get("airport")
                or p.get("destination_airport")
                or p.get("location_airport")
                or p.get("aircraft_tail")
                or ""
            )
            lines.append(
                f"EVENT: {e.get('kind', '?')} at {loc or 'network-wide'} · "
                f"severity {p.get('severity', 'n/a')} · triggered {e.get('triggered_at', '?')}"
            )
    else:
        lines.append("EVENT: none active — network operating to plan")

    # cascade
    cs = st.cascade_summary or {}
    if cs.get("total_affected"):
        lines.append(
            f"CASCADE: {cs.get('directly_affected', 0)} direct hits, "
            f"{cs.get('cascade_1', 0)} first-order + {cs.get('cascade_2', 0)} second-order knock-ons, "
            f"{cs.get('total_affected', 0)} affected total, {cs.get('total_delay_minutes', 0)} min system delay"
        )

    # recovery plans
    for p in st.recovery_plans:
        cb = p.get("cost_breakdown") or {}
        lines.append(
            f"PLAN {p.get('plan_id')}: {p.get('objective_label')} · {p.get('status')} · "
            f"total {_fmt_usd(p.get('total_cost_usd'))} "
            f"(cancellations {_fmt_usd(cb.get('cancellation_total_usd'))}, delays {_fmt_usd(cb.get('delay_total_usd'))}) · "
            f"{len(p.get('cancelled_flights') or [])} cancels · "
            f"{len(p.get('delayed_flights') or [])} delays · "
            f"{len(p.get('aircraft_swaps') or [])} swaps · "
            f"{p.get('crew_violations', 0)} FAR-117 flags · "
            f"pax delay {p.get('total_passenger_delay_minutes', 0)} min · "
            f"CO2 {p.get('total_co2_kg', 0)} kg · solve {p.get('solve_time_ms', 0)} ms"
        )
    if st.applied_plan_id:
        lines.append(f"COMMITTED: plan {st.applied_plan_id} is applied to the live state")
    elif st.recovery_plans:
        lines.append("COMMITTED: none yet — operator has not applied a plan")

    # the worst-hit flights, so "why was NBxxx cancelled" is answerable
    hit = sorted(
        (
            (fid, s)
            for fid, s in st.flight_states.items()
            if s.get("cascade_order", -1) >= 0
        ),
        key=lambda kv: (kv[1].get("cascade_order", 9), -kv[1].get("delay_minutes", 0)),
    )[:15]
    for fid, s in hit:
        f = engine.schedule.get(fid, {})
        lines.append(
            f"FLIGHT {fid}: {f.get('origin', '?')}→{f.get('destination', '?')} · {s.get('status')} · "
            f"+{s.get('delay_minutes', 0)}min · cascade order {s.get('cascade_order')}"
            + (f" · action {s.get('applied_action')}" if s.get("applied_action") else "")
        )

    return "\n".join(lines)


SYSTEM_PROMPT = """You are Aeolus, the copilot inside an airline Operations Control Center console.
The OPS STATE block below is the ground truth from a deterministic simulation engine
(CP-SAT recovery optimizer + physics cascade predictor). Answer the dispatcher's
question using ONLY those numbers — never invent flights, costs, or plans that are
not in the block. Cite figures as they appear. Be concise and operational: short
paragraphs or tight bullet lists, no headers, no fluff. If the state block cannot
answer the question, say exactly what is missing and which console action would
produce it (e.g. "trigger an event", "run the optimizer", "apply a plan")."""


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    # short rolling history, oldest first — [{role: "user"|"model", text: str}]
    history: list[dict] = Field(default_factory=list, max_length=12)


@router.post("/agent/ask")
async def agent_ask(payload: AskRequest, request: Request):
    """Grounded copilot answer over the live simulation state."""
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    ip = _client_ip(request)
    allowed, retry_after = _take_token(ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit: 10 questions/min. Give it a moment."},
            headers={"Retry-After": str(int(retry_after) + 1)},
        )

    engine = request.app.state.engine
    context = _engine_context(engine)

    contents: list[dict] = []
    for turn in payload.history[-8:]:
        role = "model" if turn.get("role") == "model" else "user"
        text = str(turn.get("text", ""))[:2000]
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append(
        {
            "role": "user",
            "parts": [
                {"text": f"OPS STATE (live, authoritative):\n{context}\n\nQUESTION: {payload.question}"}
            ],
        }
    )

    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        # Flash "thinks" by default and those tokens bill against
        # maxOutputTokens (and can't be disabled on this model — budget 0
        # returns 400 INVALID_ARGUMENT). Cap high enough that thinking never
        # starves the visible answer.
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
    }

    url = GEMINI_URL.format(model=settings.gemini_model)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "X-goog-api-key": settings.gemini_api_key,
                },
            )
    except httpx.HTTPError as exc:
        logger.warning("Gemini request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Copilot upstream unreachable") from exc

    if resp.status_code == 429:
        return JSONResponse(
            status_code=429,
            content={"detail": "Copilot is over its upstream quota — try again shortly."},
            headers={"Retry-After": "20"},
        )
    if resp.status_code != 200:
        logger.warning("Gemini error %d: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail=f"Copilot upstream error ({resp.status_code})")

    data = resp.json()
    try:
        answer = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="Copilot returned an empty answer")

    usage = data.get("usageMetadata", {})
    return {
        "answer": answer,
        "model": data.get("modelVersion", settings.gemini_model),
        "tokens": {
            "prompt": usage.get("promptTokenCount", 0),
            "output": usage.get("candidatesTokenCount", 0),
        },
        "grounded_on": {
            "active_events": len(engine.state.active_events),
            "recovery_plans": len(engine.state.recovery_plans),
            "flights": len(engine.schedule),
        },
    }
