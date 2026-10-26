// 주변 정류장 검색 (TASK-012, FR-003, AC-003, D-03·D-20·D-24)
// 브라우저 안에서만 계산한다. 출발지 좌표를 어디로도 보내지 않는다.

import type { Coordinates, Stop } from "../../shared/domain";
import { haversineMeters } from "../../shared/geo";

export const NEARBY_RADIUS_METERS = 500;
export const EXPANDED_RADIUS_METERS = 1_000;

// 짝 정류장(D-32 승인 2026-10-27): 반경 안 정류장과 이름이 같고 이 거리 이내인 반경 밖 정류장(길 건너 반대 방향)
export const PAIR_MAX_METERS = 100;

export interface NearbyStop {
  stop: Stop & { coordinates: Coordinates };
  distanceMeters: number;
  // 반경 밖이지만 짝 정류장 규칙(D-32)으로 함께 보여 주는 정류장. 지도·목록·경로 탐색 후보에 모두 포함
  pairOfId?: string;
}

// 좌표 확인 불가 정류장(D-24)은 제외. 거리 ≤ 반경 포함(D-03), 거리 오름차순·동률 시 정류장 ID 순(D-20)
export function findStopsWithin(stops: ReadonlyArray<Stop>, origin: Coordinates, radiusMeters: number): NearbyStop[] {
  const found: NearbyStop[] = [];
  for (const stop of stops) {
    if (!stop.coordinates) continue;
    const distanceMeters = haversineMeters(origin, stop.coordinates);
    if (distanceMeters <= radiusMeters) found.push({ stop: { ...stop, coordinates: stop.coordinates }, distanceMeters });
  }
  return found.sort((a, b) => a.distanceMeters - b.distanceMeters || compareId(a.stop.id, b.stop.id));
}

// 반경 안 결과에 짝 정류장(D-32)을 덧붙인다. 반경 안 결과 뒤에 거리순으로 둔다
export function withPairStops(stops: ReadonlyArray<Stop>, found: NearbyStop[], origin: Coordinates): NearbyStop[] {
  if (found.length === 0) return found;
  const included = new Set(found.map((n) => n.stop.id));
  const names = new Set(found.map((n) => n.stop.name));
  const pairs: NearbyStop[] = [];
  for (const candidate of stops) {
    if (!candidate.coordinates || included.has(candidate.id) || !names.has(candidate.name)) continue;
    const partner = found.find(
      (n) => n.stop.name === candidate.name && haversineMeters(n.stop.coordinates, candidate.coordinates!) <= PAIR_MAX_METERS,
    );
    if (!partner) continue;
    included.add(candidate.id);
    pairs.push({
      stop: { ...candidate, coordinates: candidate.coordinates },
      distanceMeters: haversineMeters(origin, candidate.coordinates),
      pairOfId: partner.stop.id,
    });
  }
  pairs.sort((a, b) => a.distanceMeters - b.distanceMeters || compareId(a.stop.id, b.stop.id));
  return [...found, ...pairs];
}

const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// AC-003 상태 흐름(D-32로 짝 정류장 추가): 500m → (0건) 확대 안내 → 동의 시 1km 1회 → 결과 또는 없음. 자동 확대·추가 확대 없음
export type NearbyState =
  | { phase: "results"; radiusMeters: number; stops: NearbyStop[] }
  | { phase: "offer_expansion" }
  | { phase: "expansion_declined" }
  | { phase: "none_within_expanded" };

export function searchNearby(stops: ReadonlyArray<Stop>, origin: Coordinates): NearbyState {
  const found = withPairStops(stops, findStopsWithin(stops, origin, NEARBY_RADIUS_METERS), origin);
  return found.length > 0 ? { phase: "results", radiusMeters: NEARBY_RADIUS_METERS, stops: found } : { phase: "offer_expansion" };
}

export function expandNearby(state: NearbyState, stops: ReadonlyArray<Stop>, origin: Coordinates): NearbyState {
  if (state.phase !== "offer_expansion" && state.phase !== "expansion_declined") return state;
  const found = withPairStops(stops, findStopsWithin(stops, origin, EXPANDED_RADIUS_METERS), origin);
  return found.length > 0
    ? { phase: "results", radiusMeters: EXPANDED_RADIUS_METERS, stops: found }
    : { phase: "none_within_expanded" };
}

export function declineExpansion(state: NearbyState): NearbyState {
  return state.phase === "offer_expansion" ? { phase: "expansion_declined" } : state;
}

// 표시용 반올림(비교에는 쓰지 않는다 — D-03)
export function formatDistance(meters: number): string {
  return `${Math.round(meters).toLocaleString("ko-KR")}m`;
}
