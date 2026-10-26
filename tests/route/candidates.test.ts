// 승차·하차 후보와 경로 탐색 시작 조건 (TASK-015, FR-006·FR-007, AC-006·AC-007)
import { describe, expect, it } from "vitest";
import type { Coordinates, Stop } from "../../shared/domain";
import { routeReadiness } from "../../src/route/candidates";
import { declineExpansion, expandNearby, searchNearby } from "../../src/stops/nearby";
import { DESTINATION_ITEM_ID, ORIGIN_ITEM_ID, nearbyMapItems } from "../../src/stops/mapItems";
import { markerHtml, toMarkerInputs } from "../../src/map/markers";

const ORIGIN: Coordinates = { lat: 33.5, lng: 126.5 };
const DEST: Coordinates = { lat: 33.3, lng: 126.6 };
const north = (from: Coordinates, m: number): Coordinates => ({ lat: from.lat + m / 111_195, lng: from.lng });
const stop = (id: string, c: Coordinates): Stop => ({ id, name: `가상${id}`, coordinates: c });

const NEAR_ORIGIN = stop("O1", north(ORIGIN, 200));
const FAR_ORIGIN = stop("O2", north(ORIGIN, 800)); // 500m 밖·1km 안
const NEAR_DEST = stop("D1", north(DEST, 300));
const FAR_DEST = stop("D2", north(DEST, 900));

describe("routeReadiness (AC-006)", () => {
  it("목적지 선택 전(상태 없음) → 탐색 불가, 목적지 지정 필요", () => {
    const r = routeReadiness({ origin: searchNearby([NEAR_ORIGIN], ORIGIN), destination: null });
    expect(r).toEqual({ ready: false, missing: ["destination"], needsConsent: [], noCandidates: [] });
  });

  it("둘 다 선택 전 → 둘 다 필요", () => {
    expect(routeReadiness({ origin: null, destination: null })).toMatchObject({ ready: false, missing: ["origin", "destination"] });
  });

  it("둘 다 500m 후보 있음 → 탐색 가능, 후보 목록 전달", () => {
    const r = routeReadiness({ origin: searchNearby([NEAR_ORIGIN, NEAR_DEST], ORIGIN), destination: searchNearby([NEAR_ORIGIN, NEAR_DEST], DEST) });
    expect(r.ready).toBe(true);
    if (r.ready) {
      expect(r.origin.map((n) => n.stop.id)).toEqual(["O1"]);
      expect(r.destination.map((n) => n.stop.id)).toEqual(["D1"]);
    }
  });
});

describe("위치별 확대 동의 (AC-007)", () => {
  const stops = [FAR_ORIGIN, NEAR_DEST];

  it("출발지만 0건 → 출발지만 동의 요청, 목적지는 500m 결과 유지", () => {
    const origin = searchNearby(stops, ORIGIN);
    const destination = searchNearby(stops, DEST);
    expect(routeReadiness({ origin, destination })).toEqual({ ready: false, missing: [], needsConsent: ["origin"], noCandidates: [] });
    expect(destination).toMatchObject({ phase: "results", radiusMeters: 500 });
  });

  it("출발지 동의 → 출발지만 1km, 목적지는 그대로 500m → 탐색 가능", () => {
    const origin = expandNearby(searchNearby(stops, ORIGIN), stops, ORIGIN);
    const destination = searchNearby(stops, DEST);
    const r = routeReadiness({ origin, destination });
    expect(r.ready).toBe(true);
    expect(origin).toMatchObject({ radiusMeters: 1000 });
    expect(destination).toMatchObject({ radiusMeters: 500 });
  });

  it("둘 다 0건 → 각각 동의 요청, 동의한 위치만 1km", () => {
    const both = [FAR_ORIGIN, FAR_DEST];
    const origin = expandNearby(searchNearby(both, ORIGIN), both, ORIGIN);
    const destination = searchNearby(both, DEST);
    expect(routeReadiness({ origin: searchNearby(both, ORIGIN), destination })).toMatchObject({ needsConsent: ["origin", "destination"] });
    expect(routeReadiness({ origin, destination })).toEqual({ ready: false, missing: [], needsConsent: ["destination"], noCandidates: [] });
  });

  it("거절하거나 동의 후에도 0건 → 경로 미생성(후보 없음 안내)", () => {
    const none = [NEAR_ORIGIN];
    const declined = declineExpansion(searchNearby(none, DEST));
    const expandedEmpty = expandNearby(searchNearby(none, DEST), none, DEST);
    for (const destination of [declined, expandedEmpty]) {
      expect(routeReadiness({ origin: searchNearby(none, ORIGIN), destination })).toEqual({
        ready: false,
        missing: [],
        needsConsent: [],
        noCandidates: ["destination"],
      });
    }
  });
});

describe("지도 항목", () => {
  it("출발지·목적지 지점은 서로 다른 마커, 목적지 후보 정류장은 지도에 따로 그리지 않음", () => {
    const items = toMarkerInputs(nearbyMapItems(searchNearby([NEAR_ORIGIN, NEAR_DEST], ORIGIN), ORIGIN, DEST));
    expect(items.map((i) => i.id)).toEqual([ORIGIN_ITEM_ID, DESTINATION_ITEM_ID, "O1"]);
    expect(markerHtml(items[1], false)).toContain("map-marker-destination");
  });

  it("목적지만 있을 때 목적지 마커만", () => {
    expect(toMarkerInputs(nearbyMapItems(null, null, DEST)).map((i) => i.id)).toEqual([DESTINATION_ITEM_ID]);
  });
});
