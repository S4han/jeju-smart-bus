// 지도·목록 동기화 (TASK-013, FR-004·FR-020, AC-004·AC-020)
import { describe, expect, it } from "vitest";
import type { Coordinates, Stop } from "../../shared/domain";
import { escapeHtml, markerHtml, toMarkerInputs } from "../../src/map/markers";
import { ORIGIN_ITEM_ID, boundsOf, nearbyMapItems, nearbyStopsOf } from "../../src/stops/mapItems";
import { expandNearby, searchNearby, type NearbyState } from "../../src/stops/nearby";

const ORIGIN: Coordinates = { lat: 33.5, lng: 126.5 };
const at = (dLatMeters: number, dLngDeg = 0): Coordinates => ({ lat: ORIGIN.lat + dLatMeters / 111_195, lng: ORIGIN.lng + dLngDeg });
const STOPS: Stop[] = [
  { id: "A", name: "가상A", coordinates: at(100) },
  { id: "B", name: "가상B", coordinates: at(-300, 0.001) },
  { id: "N", name: "좌표없음", coordinates: null },
  { id: "F", name: "먼곳", coordinates: at(900) },
];

const markerStopIds = (state: NearbyState) =>
  toMarkerInputs(nearbyMapItems(state, ORIGIN)).filter((m) => m.kind === "stop").map((m) => m.id).sort();
const listIds = (state: NearbyState) => nearbyStopsOf(state).map((n) => n.stop.id).sort();

describe("지도 마커 = 목록 (AC-004)", () => {
  it("500m 결과: 마커 정류장 ID 집합과 목록 ID 집합이 같다", () => {
    const state = searchNearby(STOPS, ORIGIN);
    expect(listIds(state)).toEqual(["A", "B"]);
    expect(markerStopIds(state)).toEqual(listIds(state));
  });

  it("1km 확대 결과도 같은 집합", () => {
    const stops = STOPS.filter((s) => s.id === "F" || s.id === "N");
    const state = expandNearby(searchNearby(stops, ORIGIN), stops, ORIGIN);
    expect(listIds(state)).toEqual(["F"]);
    expect(markerStopIds(state)).toEqual(["F"]);
  });

  it("결과 없음·확대 안내 상태: 정류장 마커 없음, 출발지 마커만", () => {
    const state = searchNearby([STOPS[3]], ORIGIN);
    expect(state.phase).toBe("offer_expansion");
    expect(toMarkerInputs(nearbyMapItems(state, ORIGIN)).map((m) => m.id)).toEqual([ORIGIN_ITEM_ID]);
  });

  it("좌표 없는 정류장은 지도·목록 어디에도 없다 (AC-004·AC-020)", () => {
    const state = expandNearby(searchNearby(STOPS, ORIGIN), STOPS, ORIGIN);
    expect(listIds(state)).not.toContain("N");
    expect(markerStopIds(state)).not.toContain("N");
  });
});

describe("마커 모양", () => {
  it("출발지와 정류장은 구분되고, 선택한 정류장은 강조된다", () => {
    const [origin, stop] = toMarkerInputs(nearbyMapItems(searchNearby(STOPS, ORIGIN), ORIGIN));
    expect(markerHtml(origin, false)).toContain("map-marker-origin");
    expect(markerHtml(stop, false)).toContain("map-marker-stop");
    expect(markerHtml(stop, false)).not.toContain("is-selected");
    expect(markerHtml(stop, true)).toContain("is-selected");
  });

  it("kind 없는 항목(PoC 마커)은 SDK 기본 마커 그대로", () => {
    expect(markerHtml({ id: "jeju-city", title: "제주시", position: ORIGIN }, false)).toBeNull();
  });
});

describe("boundsOf", () => {
  it("출발지·정류장을 모두 담는 범위", () => {
    expect(boundsOf([ORIGIN, { lat: 33.4, lng: 126.6 }])).toEqual({ sw: { lat: 33.4, lng: 126.5 }, ne: { lat: 33.5, lng: 126.6 } });
    expect(boundsOf([])).toBeNull();
  });
});

// 정류장 이름 라벨(TASK-024)

describe("정류장 이름 라벨", () => {
  const stop = { id: "405000001", title: "제주시청(광양방면)", position: { lat: 33.5, lng: 126.53 }, kind: "stop" as const };
  it("정류장 마커에 이름을 함께 표시", () => {
    expect(markerHtml(stop, false)).toContain('<span class="map-marker-label">제주시청(광양방면)</span>');
    expect(markerHtml({ ...stop, id: "step-1", title: "1. 성산일출봉입구", kind: "step", stepNumber: 1 }, false)).toContain(
      '<span class="map-marker-label">성산일출봉입구</span>',
    );
  });
  it("외부 데이터 이름은 HTML로 해석되지 않게 이스케이프", () => {
    const html = markerHtml({ ...stop, title: '<img src=x onerror="alert(1)">&' }, false)!;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;");
    expect(escapeHtml("A'B")).toBe("A&#39;B");
  });
});
