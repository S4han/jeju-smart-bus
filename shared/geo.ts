// 거리 계산 (D-03 (A): 하버사인 직선거리, 반올림 없이 비교)

import type { Coordinates } from "./domain.js";

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
