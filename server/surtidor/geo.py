"""Distances used to rank stations and to gate price reports."""

from __future__ import annotations

import math

EARTH_M = 6_371_000
REPORT_RADIUS_M = 300


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_M * math.asin(math.sqrt(a))


def bounding_box(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    dlat = radius_m / 111_320
    denom = 111_320 * max(0.2, math.cos(math.radians(lat)))
    dlng = radius_m / denom
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng
