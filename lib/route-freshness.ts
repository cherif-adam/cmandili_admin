/**
 * Decides when a drawn route has gone stale and must be re-fetched.
 *
 * Straight port of the mobile apps' `lib/core/services/route_freshness.dart`,
 * kept deliberately identical — same threshold, same rate-limit floor, same
 * point-to-segment maths — so the admin map redraws on exactly the rule the
 * client and driver apps already use. If one side is ever retuned, the other
 * has to move with it or the two will disagree about where a driver is.
 *
 * The naive rule — "re-fetch once the driver has moved N meters from where we
 * last asked" — is the wrong question. A driver following the route perfectly
 * for 300 m triggers a pointless re-fetch, while a driver who turns off the
 * route 50 m after the last fetch keeps a visibly wrong line until they have
 * covered the full 300 m.
 *
 * This asks the right question instead: how far is the driver from the line we
 * drew? A driver on the route stays within GPS noise of it no matter how far
 * they travel; a driver who takes a different street diverges immediately.
 */

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

/**
 * Distance from the drawn line beyond which the driver is considered to have
 * taken a different street. Wide enough to absorb urban GPS error and
 * dual-carriageway offsets, tight enough to catch a real wrong turn within a
 * block.
 */
export const OFF_ROUTE_THRESHOLD_METERS = 55;

/**
 * Hard floor between two Directions calls for the *same* destination, so a
 * driver weaving along a noisy GPS track cannot spam the API (and the billing)
 * with a request per refresh.
 */
export const MIN_REFETCH_INTERVAL_MS = 12_000;

/**
 * True when `driver` has strayed further than {@link OFF_ROUTE_THRESHOLD_METERS}
 * from `route` — i.e. they are driving a street the drawn line does not cover.
 * Returns true for an empty/short route so the first fetch happens.
 */
export function isOffRoute(
  route: LatLngLiteral[] | null | undefined,
  driver: LatLngLiteral,
): boolean {
  if (!route || route.length < 2) return true;
  return distanceToRouteMeters(route, driver) > OFF_ROUTE_THRESHOLD_METERS;
}

/**
 * Shortest distance in meters from `p` to the polyline `route`, measured
 * against each segment rather than only the vertices — a vertex-only check
 * reports a driver mid-way along a long straight segment as far off route when
 * they are exactly on it.
 */
export function distanceToRouteMeters(
  route: LatLngLiteral[],
  p: LatLngLiteral,
): number {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = pointToSegmentMeters(p, route[i], route[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Distance from point to line segment, computed in a local meters-based frame.
 * At delivery scale the equirectangular projection error is far below GPS
 * noise, and it avoids a trig-heavy geodesic solve per segment on every
 * refresh.
 */
function pointToSegmentMeters(
  p: LatLngLiteral,
  a: LatLngLiteral,
  b: LatLngLiteral,
): number {
  const metersPerDegree = 111320;
  const latScale = Math.cos((p.lat * Math.PI) / 180);

  const px = p.lng * metersPerDegree * latScale;
  const py = p.lat * metersPerDegree;
  const ax = a.lng * metersPerDegree * latScale;
  const ay = a.lat * metersPerDegree;
  const bx = b.lng * metersPerDegree * latScale;
  const by = b.lat * metersPerDegree;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  // Degenerate segment (duplicate vertices): fall back to point distance.
  if (lengthSquared === 0) {
    return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
  }

  // Project p onto the segment, clamped to its endpoints.
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.min(1, Math.max(0, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}
