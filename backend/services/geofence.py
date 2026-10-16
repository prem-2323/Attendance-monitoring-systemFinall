"""
Office GPS geofence-box service.

Attendance is allowed ONLY when the employee's GPS position falls inside the
configured office polygon (ray-casting point-in-polygon test). The polygon
corners come from the OFFICE_GEOFENCE_POLYGON env variable:

    "lat,lng;lat,lng;..."  (corners in order around the premises)
"""
import math
from typing import List, Tuple, Optional

from backend.config import OFFICE_GEOFENCE_POLYGON

# (lat, lng) corner — fallback matches OFFICE_GEOFENCE_POLYGON default.
_FALLBACK_POLYGON: List[Tuple[float, float]] = [
    (11.270872464050166, 77.60414913913843),
    (11.269939620797608, 77.60419457796888),
    (11.26989802898974, 77.60290714443924),
    (11.270798193201482, 77.60284050082124),
]


def parse_polygon(raw: Optional[str]) -> List[Tuple[float, float]]:
    """Parse a 'lat,lng;lat,lng;...' string into [(lat, lng), ...]."""
    polygon: List[Tuple[float, float]] = []
    if raw:
        for part in raw.split(";"):
            part = part.strip()
            if not part or "," not in part:
                continue
            try:
                lat_s, lng_s = part.split(",", 1)
                polygon.append((float(lat_s.strip()), float(lng_s.strip())))
            except ValueError:
                continue
    return polygon if len(polygon) >= 3 else list(_FALLBACK_POLYGON)


def get_configured_polygon() -> List[Tuple[float, float]]:
    """Polygon corners from env (falls back to the office default box)."""
    return parse_polygon(OFFICE_GEOFENCE_POLYGON)


def point_in_polygon(lat: float, lng: float, polygon: List[Tuple[float, float]]) -> bool:
    """
    Ray-casting test: True when (lat, lng) lies inside the polygon
    (or exactly on its edge). x = lng, y = lat.
    """
    if not polygon or len(polygon) < 3:
        return False
    inside = False
    n = len(polygon)
    x, y = lng, lat
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][1], polygon[i][0]
        xj, yj = polygon[j][1], polygon[j][0]
        # Point exactly on a polygon edge counts as inside.
        if _point_on_segment(x, y, xi, yi, xj, yj):
            return True
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _point_on_segment(px: float, py: float, x1: float, y1: float,
                      x2: float, y2: float, eps: float = 1e-9) -> bool:
    """True when P lies on segment AB (within tolerance)."""
    cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1)
    if abs(cross) > eps:
        return False
    dot = (px - x1) * (px - x2) + (py - y1) * (py - y2)
    return dot <= eps


def polygon_centroid(polygon: List[Tuple[float, float]]) -> Tuple[float, float]:
    """Arithmetic centre of the polygon corners (lat, lng)."""
    if not polygon:
        return (0.0, 0.0)
    return (
        sum(p[0] for p in polygon) / len(polygon),
        sum(p[1] for p in polygon) / len(polygon),
    )


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres (used only for display/diagnostics)."""
    r = 6371e3
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def is_inside_office(lat: Optional[float], lng: Optional[float],
                     polygon: Optional[List[Tuple[float, float]]] = None) -> bool:
    """Convenience check against the configured office box."""
    if lat is None or lng is None:
        return False
    try:
        return point_in_polygon(float(lat), float(lng), polygon or get_configured_polygon())
    except (TypeError, ValueError):
        return False
