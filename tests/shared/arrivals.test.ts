// 도착정보 판정 (TASK-014, FR-005·FR-014, AC-005·AC-014, D-04)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REALTIME_MAX_AGE_SECONDS,
  buildArrivalBoard,
  currentAgeSeconds,
  isRealtimeAge,
  type TimedArrival,
} from "../../shared/arrivals";
import { toArrival, type RawRecord } from "../../shared/bis-convert";
import type { Route } from "../../shared/domain";

const STOP = "406000191";
// 실응답 픽스처: 406000191 행(16:03:20)과 405000153 행(2025-05-08)
const { items, staleExampleItems } = JSON.parse(readFileSync("tests/fixtures/bis/bus-arrives-items.json", "utf8")) as {
  items: RawRecord[];
  staleExampleItems: RawRecord[];
};
const OBSERVED = Date.parse("2026-10-26T16:04:14+09:00");
const timed = (raw: RawRecord): TimedArrival => {
  const a = toArrival(raw)!;
  return { ...a, ageSecondsAtFetch: (OBSERVED - Date.parse(a.calculatedAt)) / 1000 };
};

// 테스트용 노선: 24번째 정류장이 STOP이 되도록 구성(가상 정류장 ID)
const routeWith = (id: string, name: string, order: number, stop = STOP): Route => ({
  id,
  name,
  subName: null,
  type: null,
  stopIds: Array.from({ length: Math.max(order, 30) }, (_, i) => (i === order - 1 ? stop : `9${String(i).padStart(8, "0")}`)),
});
const ROUTES = new Map<string, Route>([
  ["405320114", routeWith("405320114", "가상 노선 A", 24)],
  ["405320118", routeWith("405320118", "가상 노선 B", 24)],
  // 2025년 행(순번 47)이 이 정류장을 가리키도록 한 노선 — 오래된 행 혼재 시험용
  ["405104309", routeWith("405104309", "가상 노선 C", 47)],
]);
const byAgeAtFetch = (a: TimedArrival) => a.ageSecondsAtFetch;

describe("신선도 경계 (D-04)", () => {
  it("120초 이하 실시간, 121초 아님", () => {
    expect(REALTIME_MAX_AGE_SECONDS).toBe(120);
    expect(isRealtimeAge(120)).toBe(true);
    expect(isRealtimeAge(120.001)).toBe(false);
    expect(isRealtimeAge(121)).toBe(false);
  });

  it("너무 먼 미래 산출 시각은 실시간 아님(시계 이상)", () => {
    expect(isRealtimeAge(-60)).toBe(true);
    expect(isRealtimeAge(-61)).toBe(false);
  });

  it("화면 시점 나이 = 조회 시점 나이 + 캐시 체류 + 받은 뒤 경과", () => {
    expect(currentAgeSeconds(54, 15, 30_000)).toBe(99);
    expect(currentAgeSeconds(54, -3, -1)).toBe(54);
  });
});

describe("buildArrivalBoard (AC-005·AC-014)", () => {
  it("최신 행과 2025년 행이 섞여도 최신·차량 있는 행만 실시간", () => {
    const arrivals = [...items, ...staleExampleItems].map(timed);
    const board = buildArrivalBoard(STOP, arrivals, ROUTES, byAgeAtFetch);
    expect(board.realtime.map((r) => r.route.id)).toEqual(["405320114"]);
    expect(board.realtime[0].arrival).toMatchObject({ minutesToArrival: 25, stopsAway: 21, vehicleId: "7983228" });
  });

  it("arrvVhId=0 행은 실시간으로 쓰지 않고 '실시간 없음' 노선으로 센다", () => {
    const board = buildArrivalBoard(STOP, [timed(items[1])], ROUTES, byAgeAtFetch);
    expect(board.realtime).toEqual([]);
    expect(board.routesWithoutRealtime).toBe(3);
  });

  it("121초 지난 행은 실시간 아님, 120초는 실시간", () => {
    const at = (age: number) => buildArrivalBoard(STOP, [timed(items[0])], ROUTES, () => age).realtime.length;
    expect(at(120)).toBe(1);
    expect(at(121)).toBe(0);
  });

  it("스냅샷에서 이 정류장을 가리키지 않는 행(다른 정류장·없는 노선)은 제외", () => {
    const wrongOrder = { ...timed(items[0]), stopOrder: 25 };
    const unknownRoute = { ...timed(items[0]), routeId: "405999999" };
    const board = buildArrivalBoard(STOP, [wrongOrder, unknownRoute], ROUTES, byAgeAtFetch);
    expect(board.realtime).toEqual([]);
    expect(board.mismatched).toBe(2);
  });

  it("빈 응답 → 실시간 없음, 추정치 없음", () => {
    const board = buildArrivalBoard(STOP, [], ROUTES, byAgeAtFetch);
    expect(board).toEqual({ realtime: [], routesWithoutRealtime: 3, mismatched: 0 });
  });

  it("도착 시간이 빠른 순", () => {
    const a = timed(items[0]);
    const b = { ...a, routeId: "405320118", vehicleId: "1", minutesToArrival: 3 };
    expect(buildArrivalBoard(STOP, [a, b], ROUTES, byAgeAtFetch).realtime.map((r) => r.arrival.minutesToArrival)).toEqual([3, 25]);
  });
});
