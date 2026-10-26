// 도착정보 판정 (TASK-014, FR-005·FR-014, AC-005·AC-014, D-04, GATE-04)
// 서버는 상류 행을 변환해 "조회 시점 데이터 나이"를 붙여 주고, 브라우저는 스냅샷 노선으로 정류장 일치를 확인한 뒤
// 지금 시점의 나이로 실시간 여부를 다시 판정한다. 실시간이 아니면 시간 값을 보여 주지 않는다.

import type { Arrival, Route, RouteId, StopId } from "./domain.js";

// D-04 확정: 조회 시각 − calcDate ≤ 120초만 실시간(설정값)
export const REALTIME_MAX_AGE_SECONDS = 120;
// 상류·서버 시계 차이로 산출 시각이 미래로 보이는 것을 허용하는 폭(미확정 설정값)
export const FUTURE_TOLERANCE_SECONDS = 60;

export interface TimedArrival extends Arrival {
  // 서버가 상류를 조회한 시점의 데이터 나이(초). calculatedAt − 서버 시각
  ageSecondsAtFetch: number;
}

export interface ArrivalsPayload {
  status: "ok";
  stopId: StopId;
  fetchedAt: string;
  arrivals: TimedArrival[];
  // 형식 오류로 버린 상류 행 수
  invalidRows: number;
}

export function ageSecondsAt(calculatedAt: string, referenceMs: number): number | null {
  const ms = Date.parse(calculatedAt);
  return Number.isNaN(ms) ? null : (referenceMs - ms) / 1000;
}

// 화면 시점의 나이 = 서버 조회 시점 나이 + CDN 캐시 체류(Age) + 받은 뒤 지난 시간 — 기기 시계를 쓰지 않는다
export function currentAgeSeconds(ageSecondsAtFetch: number, cacheAgeSeconds: number, elapsedSinceReceiveMs: number): number {
  return ageSecondsAtFetch + Math.max(0, cacheAgeSeconds) + Math.max(0, elapsedSinceReceiveMs) / 1000;
}

export function isRealtimeAge(ageSeconds: number): boolean {
  return ageSeconds <= REALTIME_MAX_AGE_SECONDS && ageSeconds >= -FUTURE_TOLERANCE_SECONDS;
}

export interface RealtimeArrival {
  route: Route;
  arrival: TimedArrival & { vehicleId: string };
  ageSeconds: number;
}

export interface ArrivalBoard {
  realtime: RealtimeArrival[];
  // 이 정류장을 지나는 노선(스냅샷 기준) 중 지금 실시간 도착정보가 없는 노선 수
  routesWithoutRealtime: number;
  // 응답 행 중 정류장 불일치로 버린 수(AC-005)
  mismatched: number;
}

// AC-005: 응답 행의 (노선, 순번)이 스냅샷에서 이 정류장을 가리킬 때만 쓴다
export function buildArrivalBoard(
  stopId: StopId,
  arrivals: ReadonlyArray<TimedArrival>,
  routesById: ReadonlyMap<RouteId, Route>,
  ageOf: (a: TimedArrival) => number,
): ArrivalBoard {
  const realtime: RealtimeArrival[] = [];
  const realtimeRoutes = new Set<RouteId>();
  let mismatched = 0;
  for (const arrival of arrivals) {
    const route = routesById.get(arrival.routeId);
    if (!route || route.stopIds[arrival.stopOrder - 1] !== stopId) {
      mismatched++;
      continue;
    }
    // 차량 없음(arrvVhId=0)·오래된 행은 실시간으로 쓰지 않는다
    if (arrival.vehicleId === null || arrival.minutesToArrival === null) continue;
    const ageSeconds = ageOf(arrival);
    if (!isRealtimeAge(ageSeconds)) continue;
    realtime.push({ route, arrival: { ...arrival, vehicleId: arrival.vehicleId }, ageSeconds });
    realtimeRoutes.add(route.id);
  }
  realtime.sort(
    (a, b) =>
      a.arrival.minutesToArrival! - b.arrival.minutesToArrival! ||
      a.route.name.localeCompare(b.route.name, "ko") ||
      (a.route.id < b.route.id ? -1 : a.route.id > b.route.id ? 1 : 0),
  );
  let servingRoutes = 0;
  for (const route of routesById.values()) if (route.stopIds.includes(stopId)) servingRoutes++;
  return { realtime, routesWithoutRealtime: Math.max(0, servingRoutes - realtimeRoutes.size), mismatched };
}
