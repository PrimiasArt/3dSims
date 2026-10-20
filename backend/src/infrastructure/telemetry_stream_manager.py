"""
Real-time Telemetry Streaming & WebSocket Room Multiplexing Manager.
Supports room subscriptions (by session_id or printer_id), bi-directional commands
(PAUSE, RESUME, OVERRIDE_SPEED, EMERGENCY_STOP), and state broadcasting.
"""
import logging
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("3d_sim.telemetry_stream")


class TelemetryStreamManager:
    """Enhanced WebSocket manager with room multiplexing and bi-directional commands."""

    def __init__(self) -> None:
        # Map room_name -> Set of WebSockets
        self._rooms: Dict[str, Set[WebSocket]] = {"global": set()}
        # Map WebSocket -> Set of room_names it is subscribed to
        self._socket_rooms: Dict[WebSocket, Set[str]] = {}
        # Simulation control state per session/printer
        self._control_states: Dict[str, Dict[str, Any]] = {}

    async def connect(self, ws: WebSocket, initial_room: str = "global") -> None:
        """Accepts WebSocket connection and subscribes to initial room."""
        await ws.accept()
        self._socket_rooms[ws] = set()
        self.subscribe(ws, "global")
        if initial_room and initial_room != "global":
            self.subscribe(ws, initial_room)
        logger.info(f"WebSocket client connected. Active connections: {len(self._socket_rooms)}")

    def disconnect(self, ws: WebSocket) -> None:
        """Removes WebSocket from all subscribed rooms."""
        rooms = self._socket_rooms.pop(ws, set())
        for room in rooms:
            if room in self._rooms:
                self._rooms[room].discard(ws)
                if not self._rooms[room] and room != "global":
                    del self._rooms[room]
        logger.info(f"WebSocket client disconnected. Remaining connections: {len(self._socket_rooms)}")

    def subscribe(self, ws: WebSocket, room: str) -> None:
        """Subscribes a WebSocket client to a designated room."""
        if room not in self._rooms:
            self._rooms[room] = set()
        self._rooms[room].add(ws)
        if ws in self._socket_rooms:
            self._socket_rooms[ws].add(room)

    def unsubscribe(self, ws: WebSocket, room: str) -> None:
        """Unsubscribes a WebSocket client from a designated room."""
        if room in self._rooms:
            self._rooms[room].discard(ws)
        if ws in self._socket_rooms:
            self._socket_rooms[ws].discard(room)

    async def broadcast_to_room(self, room: str, message: dict, exclude: Optional[WebSocket] = None) -> None:
        """Broadcasts a JSON message to all clients in a specific room, optionally excluding sender."""
        sockets = list(self._rooms.get(room, set()))
        for ws in sockets:
            if exclude and ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)

    async def broadcast_to_rooms(self, rooms: list[str], message: dict, exclude: Optional[WebSocket] = None) -> None:
        """Broadcasts a JSON message to all unique clients across specified rooms without duplicate sends."""
        unique_sockets: set[WebSocket] = set()
        for r in rooms:
            unique_sockets.update(self._rooms.get(r, set()))
        if exclude:
            unique_sockets.discard(exclude)
        for ws in list(unique_sockets):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)

    async def broadcast(self, message: dict, room: Optional[str] = None, exclude: Optional[WebSocket] = None) -> None:
        """Broadcasts a JSON message to a specific room or to global."""
        target_room = room or "global"
        await self.broadcast_to_room(target_room, message, exclude=exclude)

    async def handle_client_message(self, ws: WebSocket, message: dict, default_time: str) -> dict:
        """
        Processes inbound client commands and returns acknowledgement / broadcasts state changes.
        Supported commands:
          - SUBSCRIBE: { "action": "subscribe", "room": "session_01" }
          - UNSUBSCRIBE: { "action": "unsubscribe", "room": "session_01" }
          - COMMAND: { "action": "command", "type": "PAUSE"|"RESUME"|"OVERRIDE_SPEED"|"EMERGENCY_STOP", "target": "session_01" }
          - PING: { "action": "ping" }
        """
        action = str(message.get("action", "")).lower()

        if action == "ping":
            return {"event": "PONG", "server_time": default_time}

        if action == "subscribe":
            room = str(message.get("room", "global"))
            self.subscribe(ws, room)
            return {"event": "SUBSCRIBED", "room": room, "status": "ok"}

        if action == "unsubscribe":
            room = str(message.get("room", "global"))
            self.unsubscribe(ws, room)
            return {"event": "UNSUBSCRIBED", "room": room, "status": "ok"}

        if action == "command":
            cmd_type = str(message.get("type", "")).upper()
            target = str(message.get("target", "global"))
            params = message.get("params", {})

            # Update control state
            if target not in self._control_states:
                self._control_states[target] = {
                    "is_paused": False,
                    "speed_multiplier": 1.0,
                    "emergency_stopped": False,
                }

            state = self._control_states[target]
            if cmd_type == "PAUSE":
                state["is_paused"] = True
            elif cmd_type == "RESUME":
                state["is_paused"] = False
                state["emergency_stopped"] = False
            elif cmd_type == "OVERRIDE_SPEED":
                state["speed_multiplier"] = float(params.get("speed_multiplier", 1.0))
            elif cmd_type == "EMERGENCY_STOP":
                state["is_paused"] = True
                state["emergency_stopped"] = True

            state["last_command"] = cmd_type
            state["updated_at"] = default_time

            # Broadcast command update to listeners of target room and global without duplication
            notification = {
                "event": "CONTROL_STATE_CHANGED",
                "target": target,
                "command": cmd_type,
                "state": state,
                "server_time": default_time,
            }
            rooms_to_notify = [target] if target == "global" else [target, "global"]
            await self.broadcast_to_rooms(rooms_to_notify, notification, exclude=ws)

            return {
                "event": "COMMAND_ACK",
                "status": "APPLIED",
                "target": target,
                "command": cmd_type,
                "current_state": state,
                "server_time": default_time,
            }

        # Default fallback: Telemetry frame relay
        frame = {
            "event": "TELEMETRY_FRAME",
            "payload": message,
            "server_time": default_time,
        }
        target_room = message.get("sessionId") or message.get("session_id")
        if target_room:
            await self.broadcast_to_room(f"session:{target_room}", frame)
        await self.broadcast_to_room("global", frame)
        return frame


telemetry_stream_mgr = TelemetryStreamManager()
