import { test } from "node:test";
import assert from "node:assert/strict";

import {
  distanceToRouteMeters,
  isOffRoute,
  type LatLngLiteral,
} from "./route-freshness.ts";

// Same fixture as the mobile suite (test/route_service_test.dart): a short
// north-bound segment in Sousse, then a right turn heading east. Keeping the
// coordinates identical means a failure here and a failure there mean the
// same thing.
const route: LatLngLiteral[] = [
  { lat: 35.825, lng: 10.635 },
  { lat: 35.83, lng: 10.635 },
  { lat: 35.83, lng: 10.645 },
];

test("distanceToRouteMeters is ~0 for a point exactly on a vertex", () => {
  assert.ok(distanceToRouteMeters(route, { lat: 35.83, lng: 10.635 }) < 1);
});

test("distanceToRouteMeters is ~0 mid-segment, not just at vertices", () => {
  // Halfway up the first leg — a vertex-only check would wrongly report this
  // as hundreds of meters off route.
  assert.ok(distanceToRouteMeters(route, { lat: 35.8275, lng: 10.635 }) < 1);
});

test("distanceToRouteMeters measures perpendicular offset from the line", () => {
  // ~0.0009 deg of longitude east of the first leg at this latitude is
  // roughly 81 m.
  const d = distanceToRouteMeters(route, { lat: 35.8275, lng: 10.6359 });
  assert.ok(d > 60, `expected > 60, got ${d}`);
  assert.ok(d < 100, `expected < 100, got ${d}`);
});

test("isOffRoute: driver on the line is not off route", () => {
  assert.equal(isOffRoute(route, { lat: 35.8275, lng: 10.635 }), false);
});

test("isOffRoute: small GPS jitter does not trigger a re-route", () => {
  // ~20 m sideways: well inside urban GPS error, must not re-route.
  assert.equal(isOffRoute(route, { lat: 35.8275, lng: 10.63522 }), false);
});

test("isOffRoute: taking a different street does trigger a re-route", () => {
  // ~180 m east of the drawn line: a genuinely different road.
  assert.equal(isOffRoute(route, { lat: 35.8275, lng: 10.637 }), true);
});

test("isOffRoute: a null or degenerate route always needs fetching", () => {
  assert.equal(isOffRoute(null, { lat: 35.8275, lng: 10.635 }), true);
  assert.equal(
    isOffRoute([{ lat: 35.825, lng: 10.635 }], { lat: 35.825, lng: 10.635 }),
    true,
  );
});
