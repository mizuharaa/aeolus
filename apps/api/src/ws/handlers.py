"""WebSocket handler for real-time simulation updates."""
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


def _snapshot_payload(engine, msg_type: str) -> dict:
    """
    Build the canonical "rebuild client state from scratch" payload.

    Used by both the initial `connected` push and the explicit `get_state`
    request. Returns EVERY field a secondary page (carbon, cascade, plans,
    crew, passengers) needs to render without re-triggering the event:

      - flight_states     : per-flight cascade order, delay, status
      - active_events     : list of disruptions still in flight
      - recovery_plans    : last optimizer solve output (A / B / C / D)
      - cascade_summary   : direct / order-1 / order-2 / total counts
      - schedule          : for /connected only — gives the schedule chrome
                            its rows without a separate REST call.

    Previously the snapshot OMITTED `cascade_summary`, which is why pages
    like /simulator/cascade flashed the empty state on every navigation
    even after a real event had been triggered.
    """
    payload: dict = {
        "type":            msg_type,
        "flight_states":   engine.state.flight_states,
        "active_events":   engine.state.active_events,
        "recovery_plans":  engine.state.recovery_plans,
        "cascade_summary": engine.state.cascade_summary,
        # Included so a fresh tab landing on /simulator/plans (or any
        # secondary surface) knows which plan letter the operator already
        # committed — the dashboard renders the Apply/Unapply button
        # accordingly without a round-trip.
        "applied_plan_id": engine.state.applied_plan_id,
    }
    if msg_type == "connected":
        # Schedule only needs to ship once on initial connect — it's static
        # within a session and the client caches it in the Zustand store.
        payload["schedule"] = engine.get_schedule_snapshot()
    return payload


async def simulation_ws_handler(websocket: WebSocket, engine) -> None:
    await websocket.accept()
    engine.add_subscriber(websocket)
    logger.info("WebSocket client connected")

    # Send current state immediately on connect so the client lands with a
    # populated cascade / plans / event view (no "Awaiting disruption" flash).
    try:
        await websocket.send_text(json.dumps(_snapshot_payload(engine, "connected")))
    except Exception as e:
        logger.warning("Failed to send initial state: %s", e)
        engine.remove_subscriber(websocket)
        return

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif msg_type == "subscribe_flight":
                flight_id = msg.get("flight_id")
                state = engine.state.flight_states.get(flight_id, {})
                await websocket.send_text(json.dumps({
                    "type": "flight_state",
                    "flight_id": flight_id,
                    "state": state,
                }))

            elif msg_type == "get_state":
                # Re-uses the same canonical snapshot builder. Clients that
                # detect a stale store (e.g. after waking from sleep) can
                # send `{"type":"get_state"}` to rehydrate without
                # tearing down the connection.
                await websocket.send_text(json.dumps(_snapshot_payload(engine, "state_snapshot")))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        engine.remove_subscriber(websocket)
