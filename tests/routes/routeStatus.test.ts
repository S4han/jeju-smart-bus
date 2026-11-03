// 노선 운행 현황(TASK-037, D-35)
import { describe, expect, it } from "vitest";
import type { Route } from "../../shared/domain";
import { matchRoutes, normalizeRouteQuery, runningVehicles } from "../../src/routes/routeStatus";
import { routeViewItems } from "../../src/stops/mapItems";
import { routeStopPath } from "../../src/route/steps";
import { markerHtml, toMarkerInputs } from "../../src/map/markers";

const R = (id: string, name: string, number?: string): Route => ({ id, name, subName: null, type: null, ...(number ? { number } : {}), stopIds: ["A", "B", "C", "D", "E"] });
const routes = [R("1", "254-3", "254"), R("2", "254-1", "254"), R("3", "2540"), R("4", "43-1", "43-2"), R("5", "254-10", "254")];

describe("노선 번호 검색", () => {
  it("표시 번호로 세부 노선을 모두 찾고 이름 순(숫자 인식)", () => {
    expect(matchRoutes(routes, "254").map((r) => r.name)).toEqual(["254-1", "254-3", "254-10"]);
  });
  it("세부 이름 그대로도 찾고, 공백·'번'은 무시", () => {
    expect(matchRoutes(routes, " 254-1 ").map((r) => r.name)).toEqual(["254-1"]);
    expect(normalizeRouteQuery("254 번")).toBe("254");
  });
  it("routeNum이 이름 앞부분과 다르면 이름으로만 찾는다(43-1)", () => {
    expect(matchRoutes(routes, "43-1").map((r) => r.name)).toEqual(["43-1"]);
    expect(matchRoutes(routes, "43-2")).toEqual([]);
  });
});

describe("운행 중 차량", () => {
  const route = R("1", "254-1", "254");
  it("차량마다 가장 먼저 도착할 정류장과 분, 노선 순서대로", () => {
    const preds = new Map([
      [2, { vehicleId: "V1", minutes: 1, calculatedAt: "" }],
      [3, { vehicleId: "V1", minutes: 4, calculatedAt: "" }],
      [4, { vehicleId: "V2", minutes: 2, calculatedAt: "" }],
      [5, { vehicleId: "V2", minutes: 5, calculatedAt: "" }],
    ]);
    expect(runningVehicles(route, preds)).toEqual([
      { vehicleId: "V1", nextStopOrder: 2, nextStopId: "B", minutes: 1 },
      { vehicleId: "V2", nextStopOrder: 4, nextStopId: "D", minutes: 2 },
    ]);
  });
  it("예측이 없으면 운행 중 차량 없음", () => {
    expect(runningVehicles(route, new Map())).toEqual([]);
  });
});


describe("노선 운행 지도 항목 (TASK-037)", () => {
  const stops = new Map(
    ["A", "B", "C"].map((id, i) => [id, { id, name: `정류장${id}`, coordinates: id === "B" ? null : { lat: 33.4 + i / 100, lng: 126.5 } }] as const),
  );
  const route = { id: "R", name: "254-1", subName: null, type: null, number: "254", stopIds: ["A", "B", "C"] };
  it("정류장은 작은 점, 차량은 다음 도착 정류장 위치에 🚌(좌표 없는 정류장의 차량은 지도에서 빠짐)", () => {
    const items = routeViewItems(route, stops, [
      { vehicleId: "V1", nextStopId: "C", minutes: 2 },
      { vehicleId: "V2", nextStopId: "B", minutes: 1 },
    ], "254");
    const markers = toMarkerInputs(items);
    expect(markers.filter((m) => m.kind === "via")).toHaveLength(2);
    const bus = markers.filter((m) => m.kind === "bus");
    expect(bus.map((m) => m.title)).toEqual(["254 · 2분 후 도착"]);
    expect(markerHtml(bus[0], false)).toContain("map-marker-bus");
  });
  it("노선 연결선은 좌표 없는 정류장에서 끊는다", () => {
    const four = { ...route, stopIds: ["A", "C", "B", "A"] };
    expect(routeStopPath(four, stops).map((s) => s.length)).toEqual([2]);
  });
});
