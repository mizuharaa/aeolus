"""WebSocket handler for real-time simulation updates."""
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


async def simulation_ws_handler(websocket: WebSocket, engine) -> None:
    await websocket.accept()
    engine.add_subscriber(websocket)
    logger.info("WebSocket client connected")

    # Send current state immediately on connect
    try:
        await websocket.send_text(json.dumps({
            "type": "connected",
            "flight_states": engine.state.flight_states,
            "active_events": engine.state.active_events,
            "recovery_plans": engine.state.recovery_plans,
            "schedule": engine.get_schedule_snapshot(),
        }))
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
                await websocket.send_text(json.dumps({
                    "type": "state_snapshot",
                    "flight_states": engine.state.flight_states,
                    "active_events": engine.state.active_events,
                    "recovery_plans": engine.state.recovery_plans,
                }))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        engine.remove_subscriber(websocket)
