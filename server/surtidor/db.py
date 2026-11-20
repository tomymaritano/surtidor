"""SQLite file that holds official prices and user reports."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "surtidor.db"
DEFAULT_CSV = ROOT / "data" / "precios.csv"
PHOTO_DIR = ROOT / "data" / "photos"

SCHEMA = """
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  search_text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS official_prices (
  station_id TEXT NOT NULL,
  fuel TEXT NOT NULL,
  price REAL NOT NULL,
  vigencia TEXT NOT NULL,
  PRIMARY KEY (station_id, fuel)
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  fuel TEXT NOT NULL,
  price REAL NOT NULL,
  created_at TEXT NOT NULL,
  photo TEXT
);
CREATE TABLE IF NOT EXISTS confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  fuel TEXT NOT NULL,
  price REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stations_lat_lng ON stations (lat, lng);
CREATE INDEX IF NOT EXISTS reports_station ON reports (station_id, fuel, created_at);
CREATE INDEX IF NOT EXISTS confirmations_station ON confirmations (station_id, fuel);
"""


def db_path() -> Path:
    return Path(os.environ.get("SURTIDOR_DB", DEFAULT_DB))


def csv_path() -> Path:
    return Path(os.environ.get("SURTIDOR_CSV", DEFAULT_CSV))


def connect(path: Path | None = None) -> sqlite3.Connection:
    target = path or db_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
