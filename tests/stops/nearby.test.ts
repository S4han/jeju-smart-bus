// 주변 정류장 검색 (TASK-012, FR-003, AC-003, D-03·D-20·D-24)
import { describe, expect, it } from "vitest";
import type { Coordinates, Stop } from "../../shared/domain";
import { haversineMeters } from "../../shared/geo";
import {
  declineExpansion,
  expandNearby,
  findStopsWithin,
  formatDistance,
  searchNearby,
} from "../../src/stops/nearby";

const ORIGIN: Coordinates = { lat: 33.5, lng: 126.5 };
// 출발지에서 정북으로 meters만큼 떨어진 좌표(하버사인 정북 거리 = R·Δφ)
const north = (meters: number): Coordinates => ({ lat: ORIGIN.lat + (meters / 6_371_000) * (180 / Math.PI), lng: ORIGIN.lng });
const east = (meters: number): Coordinates => {
  // 정동 방향은 위도에 따라 달라지므로 이분 탐색으로 맞춘다
  let lo = 0, hi = 0.1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (haversineMeters(ORIGIN, { lat: ORIGIN.lat, lng: ORIGIN.lng + mid }) <= meters) lo = mid; else hi = mid;
  }
  return { lat: ORIGIN.lat, lng: ORIGIN.lng + lo };
};
const stop = (id: string, coordinates: Coordinates | null): Stop => ({ id, name: `가상${id}`, coordinates });

describe("findStopsWithin (AC-003 예시)", () => {
  it("거리 계산: 정북 500m", () => {
    expect(haversineMeters(ORIGIN, north(500))).toBeCloseTo(500, 6);
  });

  it("450m·500m 포함, 550m 제외 — 반올림 없이 거리 ≤ 반경 (D-03)", () => {
    const stops = [stop("S450", north(450)), stop("S500", east(500)), stop("S550", north(550))];
    expect(haversineMeters(ORIGIN, east(500))).toBeLessThanOrEqual(500);
    expect(findStopsWithin(stops, ORIGIN, 500).map((n) => n.stop.id)).toEqual(["S450", "S500"]);
  });

  it("500m를 조금이라도 넘으면 제외(반올림하면 500이 되는 500.4m 포함)", () => {
    expect(findStopsWithin([stop("S", north(500.4))], ORIGIN, 500)).toEqual([]);
  });

  it("좌표 확인 불가 정류장 제외 (D-24 — 뒤바뀐 좌표도 변환 단계에서 null)", () => {
    expect(findStopsWithin([stop("N", null), stop("A", north(10))], ORIGIN, 500).map((n) => n.stop.id)).toEqual(["A"]);
  });

  it("거리 오름차순, 동률은 정류장 ID 순 — 입력 순서와 무관 (D-20)", () => {
    const p = north(100);
    const a = [stop("B", p), stop("C", north(50)), stop("A", p)];
    const ids = (s: Stop[]) => findStopsWithin(s, ORIGIN, 500).map((n) => n.stop.id);
    expect(ids(a)).toEqual(["C", "A", "B"]);
    expect(ids([...a].reverse())).toEqual(["C", "A", "B"]);
  });
});

describe("검색 흐름 (AC-003)", () => {
  it("500m 안에 있으면 결과, 확대 안내 없음", () => {
    const state = searchNearby([stop("A", north(300)), stop("F", north(800))], ORIGIN);
    expect(state).toMatchObject({ phase: "results", radiusMeters: 500 });
    expect(state.phase === "results" && state.stops.map((n) => n.stop.id)).toEqual(["A"]);
  });

  it("0건 → 확대 안내, 동의 전에는 1km 결과를 만들지 않는다", () => {
    const state = searchNearby([stop("F", north(800))], ORIGIN);
    expect(state).toEqual({ phase: "offer_expansion" });
  });

  it("동의 → 1km 이내만(1,000m 포함·1,001m 제외)", () => {
    const stops = [stop("F", north(800)), stop("K", east(1000)), stop("X", north(1001))];
    const state = expandNearby(searchNearby(stops, ORIGIN), stops, ORIGIN);
    expect(state.phase === "results" && state.radiusMeters).toBe(1000);
    expect(state.phase === "results" && state.stops.map((n) => n.stop.id)).toEqual(["F", "K"]);
  });

  it("동의 후 0건 → 없음 표시, 추가 확대 없음", () => {
    const stops = [stop("X", north(1500))];
    const none = expandNearby(searchNearby(stops, ORIGIN), stops, ORIGIN);
    expect(none).toEqual({ phase: "none_within_expanded" });
    expect(expandNearby(none, stops, ORIGIN)).toBe(none);
  });

  it("취소 → 확대하지 않음, 이후 사용자가 다시 요청하면 1km 검색", () => {
    const stops = [stop("F", north(800))];
    const declined = declineExpansion(searchNearby(stops, ORIGIN));
    expect(declined).toEqual({ phase: "expansion_declined" });
    expect(expandNearby(declined, stops, ORIGIN)).toMatchObject({ phase: "results", radiusMeters: 1000 });
  });

  it("결과 상태에서는 확대·취소가 아무것도 바꾸지 않는다", () => {
    const stops = [stop("A", north(100)), stop("F", north(800))];
    const results = searchNearby(stops, ORIGIN);
    expect(expandNearby(results, stops, ORIGIN)).toBe(results);
    expect(declineExpansion(results)).toBe(results);
  });

  it("거리 표시는 반올림(비교에는 쓰지 않음)", () => {
    expect(formatDistance(499.6)).toBe("500m");
    expect(formatDistance(1000)).toBe("1,000m");
  });
});
