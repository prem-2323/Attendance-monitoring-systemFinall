/**
 * Office GPS geofence BOX — attendance is allowed ONLY inside this polygon.
 * Corners come from VITE_OFFICE_GEOFENCE_POLYGON ("lat,lng;lat,lng;..."),
 * falling back to the configured office box below.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const FALLBACK_POLYGON: GeoPoint[] = [
  { lat: 11.144113653811853, lng: 77.32556489217428 },
  { lat: 11.14405891876983, lng: 77.32565787042074 },
  { lat: 11.143960395668193, lng: 77.32561572028234 },
  { lat: 11.144007832721298, lng: 77.32552646116577 },
];

function parsePolygon(raw: string | undefined): GeoPoint[] {
  if (!raw) return [...FALLBACK_POLYGON];
  const pts: GeoPoint[] = [];
  for (const part of raw.split(';')) {
    const seg = part.trim();
    if (!seg || !seg.includes(',')) continue;
    const [latS, lngS] = seg.split(',', 2);
    const lat = Number(latS.trim());
    const lng = Number(lngS.trim());
    if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
  }
  return pts.length >= 3 ? pts : [...FALLBACK_POLYGON];
}

/** Configured office box corners (env-driven). */
export const OFFICE_GEOFENCE_POLYGON: GeoPoint[] = parsePolygon(
  (import.meta as any)?.env?.VITE_OFFICE_GEOFENCE_POLYGON
);

/** Centre of the office box (for display / distance diagnostics). */
export const OFFICE_BOX_CENTER: GeoPoint = (() => {
  const p = OFFICE_GEOFENCE_POLYGON;
  return {
    lat: p.reduce((s, q) => s + q.lat, 0) / p.length,
    lng: p.reduce((s, q) => s + q.lng, 0) / p.length,
  };
})();

/**
 * Ray-casting point-in-polygon test. Returns true when (lat, lng) is
 * inside the office box (points on the edge count as inside).
 */
export function isInsideGeofenceBox(lat: number, lng: number, polygon: GeoPoint[] = OFFICE_GEOFENCE_POLYGON): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const x = lng;
  const y = lat;
  let j = polygon.length - 1;
  for (let i = 0; i < polygon.length; i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    if (onSegment(x, y, xi, yi, xj, yj)) return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function onSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= 1e-9;
}

/** Haversine distance in metres (display/diagnostics only — the box decides). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
