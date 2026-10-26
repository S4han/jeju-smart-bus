// 총 소요시간 산정 (TASK-017 시간 부분, FR-010·AC-010·AC-011, GATE-05 산식, D-06 (A)·D-31)
import { describe, expect, it } from "vitest";
import type { TimedArrival } from "../../shared/arrivals";
import type { Route } from "../../shared/domain";
import type { Journey, Leg } from "../../src/route/engine";
import { buildResultSections } from "../../src/route/ranking";
import { buildRoutePredictions, journeyTime, realtimeEstimator, walkMinutesOf, type RoutePredictions } from "../../src/route/timing";
import { routesToRequest } from "../../src/route/useJourneyTimes";

// 가상 노선(정류장 ID는 가상). GATE-05 §4 예시의 순번·예측 분을 그대로 씀
const stops = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(3, "0")}`);
const R1: Route = { id: "R1", name: "가상 312-1", subName: null, type: null, stopIds: stops("A", 74) };
const R2: Route = { id: "R2", name: "가상 411-1", subName: null, type: null, stopIds: stops("B", 79) };
const R3: Route = { id: "R3", name: "가상 환승", subName: null, type: null, stopIds: ["A028", ...stops("C", 20)] };

const row = (route: Route, order: number, vehicle: string | null, minutes: number | null, age = 30): TimedArrival => ({
  routeId: route.id,
  stopOrder: order,
  stopId: route.stopIds[order - 1],
  vehicleId: vehicle,
  minutesToArrival: minutes,
  stopsAway: null,
  calculatedAt: "2026-10-26T11:47:20.000Z",
  source: "realtime",
  ageSecondsAtFetch: age,
});
const preds = (route: Route, rows: TimedArrival[]) => buildRoutePredictions(route, rows, (r) => r.ageSecondsAtFetch);
const leg = (route: Route, b: number, a: number): Leg => ({ routeId: route.id, boardStopId: route.stopIds[b - 1], boardOrder: b, alightStopId: route.stopIds[a - 1], alightOrder: a });
const journey = (legs: Leg[], originWalkMeters: number, destinationWalkMeters: number): Journey => ({
  id: legs.map((l) => `${l.routeId}:${l.boardStopId}>${l.alightStopId}`).join("|"),
  legs,
  transfers: legs.length - 1,
  originWalkMeters,
  destinationWalkMeters,
  walkMeters: originWalkMeters + destinationWalkMeters,
  rideStops: legs.reduce((n, l) => n + l.alightOrder - l.boardOrder, 0),
});

describe("도보 추정 (D-06 (A))", () => {
  it("직선거리 × 1.3 ÷ 분당 67m, 올림 / 0m는 0분", () => {
    expect(walkMinutesOf(150)).toBe(3);
    expect(walkMinutesOf(200)).toBe(4);
    expect(walkMinutesOf(0)).toBe(0);
  });
});

describe("GATE-05 산식", () => {
  const p1 = preds(R1, [row(R1, 23, "7983632", 22), row(R1, 28, "7983632", 32)]);
  const p2 = preds(R2, [row(R2, 66, "7983581", 2), row(R2, 71, "7983581", 11)]);
  const all = new Map<string, RoutePredictions>([["R1", p1], ["R2", p2]]);

  it("예시 1: 총 = 하차 도착 예정 32 + 목적지 도보 4 = 36분(출발지 도보 3분은 대기와 겹쳐 더하지 않음)", () => {
    const t = journeyTime(journey([leg(R1, 23, 28)], 150, 200), all)!;
    expect(t.total.minutes).toBe(36);
    expect(t.total.components).toEqual([
      { kind: "wait", minutes: 22, source: "realtime" },
      { kind: "ride", minutes: 10, source: "realtime" },
      { kind: "walk", minutes: 4, source: "estimated" },
    ]);
    expect(t.total.estimated).toBe(true);
    expect(t.walkMinutes).toBe(7);
  });

  it("예시 2: 도착 2분 전 차량을 걸어서 3분 + 여유 1분으로 못 탐 → 미확인", () => {
    expect(journeyTime(journey([leg(R2, 66, 71)], 150, 0), all)).toBeNull();
  });

  it("정류장이 출발지(도보 0)면 2분 뒤 차량도 탈 수 있음, 도보 없으면 추정 아님", () => {
    const t = journeyTime(journey([leg(R2, 66, 71)], 0, 0), all)!;
    expect(t.total).toMatchObject({ minutes: 11, estimated: false });
  });

  it("승차·하차 정류장의 최근접 차량이 다르면 구간 이동 미확인", () => {
    const p = new Map([["R1", preds(R1, [row(R1, 23, "V1", 5), row(R1, 28, "V0", 2)])]]);
    expect(journeyTime(journey([leg(R1, 23, 28)], 0, 0), p)).toBeNull();
  });

  it("예측 행이 없거나 120초 넘게 지난 행이면 미확인 (D-04)", () => {
    const stale = new Map([["R1", preds(R1, [row(R1, 23, "V", 5, 121), row(R1, 28, "V", 9, 121)])]]);
    expect(journeyTime(journey([leg(R1, 23, 28)], 0, 0), stale)).toBeNull();
    expect(journeyTime(journey([leg(R1, 23, 28)], 0, 0), new Map())).toBeNull();
  });

  it("스냅샷과 정류장이 맞지 않는 행은 버린다 (AC-005 방식)", () => {
    const wrong = { ...row(R1, 23, "V", 5), stopId: "A999" };
    expect(preds(R1, [wrong]).size).toBe(0);
  });

  it("환승: 다음 노선 차량이 도착(32) + 여유 1분 뒤에 오면 계산, 아니면 미확인", () => {
    const ok = new Map<string, RoutePredictions>([["R1", p1], ["R3", preds(R3, [row(R3, 1, "X", 35), row(R3, 6, "X", 41)])]]);
    const t = journeyTime(journey([leg(R1, 23, 28), leg(R3, 1, 6)], 0, 0), ok)!;
    expect(t.total.minutes).toBe(41);
    expect(t.total.components.map((c) => [c.kind, c.minutes])).toEqual([["wait", 22], ["ride", 10], ["transfer", 3], ["ride", 6]]);
    const tight = new Map<string, RoutePredictions>([["R1", p1], ["R3", preds(R3, [row(R3, 1, "X", 32), row(R3, 6, "X", 38)])]]);
    expect(journeyTime(journey([leg(R1, 23, 28), leg(R3, 1, 6)], 0, 0), tight)).toBeNull();
  });

  it("추천 영역: 시간 계산된 경로만, 총 소요시간 순(AC-011)", () => {
    const js = [journey([leg(R1, 23, 28)], 150, 200), journey([leg(R2, 66, 71)], 0, 0), journey([leg(R2, 66, 71)], 150, 0)];
    js[2] = { ...js[2], id: js[2].id + "#late" };
    const s = buildResultSections(js, realtimeEstimator(all));
    expect(s.recommended.map((r) => r.totalTime!.minutes)).toEqual([11, 36]);
    expect(s.timeUnknown.map((r) => r.journey.id)).toEqual([js[2].id]);
  });
});

describe("예측 조회 노선 고르기 (D-30, 호출량 상한)", () => {
  it("결과 순서대로 노선을 모으되 상한을 넘기는 경로는 건너뜀, 노선별 첫 승차 정류장", () => {
    const js = [journey([leg(R1, 23, 28)], 0, 0), journey([leg(R1, 23, 28), leg(R3, 1, 6)], 0, 0), journey([leg(R2, 66, 71)], 0, 0)];
    expect([...routesToRequest(js, 2)]).toEqual([["R1", "A023"], ["R3", "A028"]]);
    expect([...routesToRequest(js, 3).keys()]).toEqual(["R1", "R3", "R2"]);
  });
});
