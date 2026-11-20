"""HTTP API. The phone app is the only client."""

from __future__ import annotations

import json
import logging
import mimetypes
import re
import uuid
from base64 import b64decode
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from surtidor.db import PHOTO_DIR, connect, migrate
from surtidor.service import (
    ApiError,
    add_confirmation,
    add_report,
    geocode,
    get_station,
    list_stations,
)

log = logging.getLogger("surtidor")
_STATION = re.compile(r"^/stations/([0-9a-f]{16})$")
_REPORT = re.compile(r"^/stations/([0-9a-f]{16})/reports$")
_CONFIRM = re.compile(r"^/stations/([0-9a-f]{16})/confirm$")
_PHOTO = re.compile(r"^/photos/([0-9a-f]{32}\.(?:jpg|png|webp))$")


def build_handler(connection_factory=connect):
    class Handler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self._send(204, b"")

        def do_GET(self):
            self._dispatch("GET")

        def do_POST(self):
            self._dispatch("POST")

        def log_message(self, fmt: str, *args):
            log.info("%s %s", self.address_string(), fmt % args)

        def _dispatch(self, method: str) -> None:
            parsed = urlparse(self.path)
            query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
            body = b""
            if method == "POST":
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else b""
            try:
                status, payload, content_type = route(
                    method, parsed.path, query, body, connection_factory
                )
            except ApiError as error:
                status, payload, content_type = error.status, error.payload, "application/json"
            except Exception:
                log.exception("request failed")
                status, payload, content_type = 500, {"error": "internal"}, "application/json"
            if content_type == "application/json":
                raw = json.dumps(payload, ensure_ascii=False).encode()
            else:
                raw = payload
            self._send(status, raw, content_type)

        def _send(self, status: int, raw: bytes, content_type: str = "text/plain") -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            if raw:
                self.wfile.write(raw)

    return Handler


def route(method: str, path: str, query: dict, body: bytes, connection_factory):
    if method == "GET" and path == "/health":
        return 200, {"ok": True}, "application/json"
    photo = _PHOTO.match(path)
    if method == "GET" and photo:
        return _read_photo(photo.group(1))
    if method == "GET" and path == "/geocode":
        try:
            result = geocode(query.get("q", ""))
        except ApiError:
            raise
        except Exception as error:
            log.warning("geocode failed: %s", error)
            raise ApiError(502, "geocode_failed") from error
        return 200, {"result": result}, "application/json"

    conn = connection_factory()
    try:
        migrate(conn)
        if method == "GET" and path == "/stations":
            payload = list_stations(
                conn,
                lat=_float(query.get("lat")),
                lng=_float(query.get("lng")),
                radius_m=_radius(query.get("radius_m")),
                fuel=query.get("fuel") or "super",
                q=query.get("q") or "",
            )
            return 200, payload, "application/json"
        station = _STATION.match(path)
        if method == "GET" and station:
            payload = get_station(
                conn,
                station.group(1),
                lat=_float(query.get("lat")),
                lng=_float(query.get("lng")),
            )
            return 200, payload, "application/json"
        report = _REPORT.match(path)
        if method == "POST" and report:
            data = _json(body)
            fuel, price, lat, lng = _report_fields(data)
            payload = add_report(
                conn,
                report.group(1),
                fuel=fuel,
                price=price,
                lat=lat,
                lng=lng,
                photo=_store_photo(data.get("photo_base64")),
            )
            return 201, payload, "application/json"
        confirm = _CONFIRM.match(path)
        if method == "POST" and confirm:
            data = _json(body)
            lat, lng = _coords(data)
            payload = add_confirmation(
                conn,
                confirm.group(1),
                fuel=str(data.get("fuel") or ""),
                lat=lat,
                lng=lng,
            )
            return 201, payload, "application/json"
    finally:
        conn.close()
    raise ApiError(404, "not_found")


def _json(body: bytes) -> dict:
    try:
        data = json.loads(body.decode() or "{}")
    except json.JSONDecodeError as error:
        raise ApiError(400, "bad_json") from error
    if not isinstance(data, dict):
        raise ApiError(400, "bad_json")
    return data


def _report_fields(data: dict) -> tuple[str, float, float, float]:
    lat, lng = _coords(data)
    try:
        return str(data.get("fuel") or ""), float(data.get("price")), lat, lng
    except (TypeError, ValueError) as error:
        raise ApiError(400, "bad_fields") from error


def _coords(data: dict) -> tuple[float, float]:
    try:
        return float(data.get("lat")), float(data.get("lng"))
    except (TypeError, ValueError) as error:
        raise ApiError(400, "bad_fields") from error


def _radius(value: str | None) -> int:
    if not value:
        return 3000
    try:
        return int(value)
    except ValueError as error:
        raise ApiError(400, "bad_radius") from error


def _float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError as error:
        raise ApiError(400, "bad_coordinate") from error


def _store_photo(encoded: str | None) -> str | None:
    if not encoded:
        return None
    if len(encoded) > 2_500_000:
        raise ApiError(400, "photo_too_large")
    try:
        raw = b64decode(encoded, validate=True)
    except Exception as error:
        raise ApiError(400, "bad_photo") from error
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.jpg"
    (PHOTO_DIR / name).write_bytes(raw)
    return name


def _read_photo(name: str):
    path = PHOTO_DIR / name
    if not path.is_file():
        raise ApiError(404, "not_found")
    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
    return 200, path.read_bytes(), mime


def serve(host: str, port: int) -> None:
    httpd = ThreadingHTTPServer((host, port), build_handler())
    log.info("listening on http://%s:%s", host, port)
    httpd.serve_forever()
