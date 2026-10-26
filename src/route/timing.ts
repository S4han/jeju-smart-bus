// 총 소요시간 산정 (TASK-017 시간 부분, FR-010·AC-010, GATE-05 산식, D-06 (A)·D-30·D-31)
// 총 소요시간 = 마지막 하차 정류장의 같은 차량 도착 예정(실시간 예측) + 목적지 도보(추정).
// 출발지 도보는 대기와 겹치므로 더하지 않고 "제때 승차 가능" 판정에만 쓴다. 조건을 하나라도 못 맞추면 미확인(null).

import { isRealtimeAge, type TimedArrival } from "../../shared/arrivals";
import type { Route, RouteId } from "../../shared/domain";
import type { Journey } from "./engine";
import { sumTime, type ComponentKind, type TimeEstimator, type TotalTime } from "./ranking";
import type { TimeComponent } from "../../shared/domain";

// D-06 (A) 직선거리 추정 — 보정계수·보행속도는 근거 없는 미확정 설정값("추정"으로만 표시)
export const WALK_DETOUR_FACTOR = 1.3;
export const WALK_METERS_PER_MINUTE = 67;
// D-31 승차·환승 여유(분) — 미확정 설정값
export const BOARD_MARGIN_MINUTES = 1;
export const TRANSFER_MARGIN_MINUTES = 1;

export interface StopPrediction {
  vehicleId: string;
  minutes: number;
  calculatedAt: string;
}

// 노선 순번(1부터) → 그 정류장에 가장 먼저 도착할 차량 예측
export type RoutePredictions = ReadonlyMap<number, StopPrediction>;

// 스냅샷 노선과 대조(AC-005 방식) + 120초 이내 행만(D-04) + 차량·분이 있는 행만
export function buildRoutePredictions(
  route: Route,
  rows: ReadonlyArray<TimedArrival>,
  ageOf: (row: TimedArrival) => number,
): Map<number, StopPrediction> {
  const byOrder = new Map<number, StopPrediction>();
  for (const row of rows) {
    if (row.routeId !== route.id || row.stopId === undefined) continue;
    if (route.stopIds[row.stopOrder - 1] !== row.stopId) continue;
    if (row.vehicleId === null || row.minutesToArrival === null || row.minutesToArrival < 0) continue;
    if (!isRealtimeAge(ageOf(row))) continue;
    byOrder.set(row.stopOrder, { vehicleId: row.vehicleId, minutes: row.minutesToArrival, calculatedAt: row.calculatedAt });
  }
  return byOrder;
}

export function walkMinutesOf(straightMeters: number): number {
  return straightMeters <= 0 ? 0 : Math.ceil((straightMeters * WALK_DETOUR_FACTOR) / WALK_METERS_PER_MINUTE);
}

type Component = TimeComponent & { kind: ComponentKind };

export interface JourneyTime {
  total: TotalTime;
  // 정렬용 도보시간(출발 + 도착, 추정) — AC-011
  walkMinutes: number;
  // 화면 표시용: 출발지 도보(대기 시간 안에서 걸음)
  originWalkMinutes: number;
}

export function journeyTime(journey: Journey, predictions: ReadonlyMap<RouteId, RoutePredictions>): JourneyTime | null {
  const w0 = walkMinutesOf(journey.originWalkMeters);
  const w1 = walkMinutesOf(journey.destinationWalkMeters);
  const components: Component[] = [];
  let arrival = 0; // 지금부터 현재 구간 하차 정류장 도착까지(분)

  for (let k = 0; k < journey.legs.length; k++) {
    const leg = journey.legs[k];
    const preds = predictions.get(leg.routeId);
    const board = preds?.get(leg.boardOrder);
    const alight = preds?.get(leg.alightOrder);
    if (!board || !alight) return null;
    // 승차·하차 정류장에 가장 먼저 오는 차량이 같아야 구간 이동을 알 수 있다
    if (board.vehicleId !== alight.vehicleId || alight.minutes < board.minutes) return null;
    if (k === 0) {
      // 걸어서 제때 닿아야 이 차량을 탈 수 있다(다음 차 시각은 모름)
      if (w0 + BOARD_MARGIN_MINUTES > board.minutes) return null;
      components.push({ kind: "wait", minutes: board.minutes, source: "realtime" });
    } else {
      if (board.minutes < arrival + TRANSFER_MARGIN_MINUTES) return null;
      components.push({ kind: "transfer", minutes: board.minutes - arrival, source: "realtime" });
    }
    components.push({ kind: "ride", minutes: alight.minutes - board.minutes, source: "realtime" });
    arrival = alight.minutes;
  }
  if (w1 > 0) components.push({ kind: "walk", minutes: w1, source: "estimated" });
  const total = sumTime(components);
  if (!total) return null;
  // 출발지 도보가 있으면 판정에 추정을 썼으므로 추정 포함
  if (journey.originWalkMeters > 0) total.estimated = true;
  return { total, walkMinutes: w0 + w1, originWalkMinutes: w0 };
}

export function realtimeEstimator(predictions: ReadonlyMap<RouteId, RoutePredictions>): TimeEstimator {
  const cache = new Map<string, JourneyTime | null>();
  const get = (j: Journey) => {
    if (!cache.has(j.id)) cache.set(j.id, journeyTime(j, predictions));
    return cache.get(j.id)!;
  };
  return { totalTime: (j) => get(j)?.total ?? null, walkMinutes: (j) => get(j)?.walkMinutes ?? null };
}
