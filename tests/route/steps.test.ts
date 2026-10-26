// 경로 단계·규칙 설명·지도 표시 (TASK-018, FR-013·FR-018·FR-020, AC-013·AC-018·AC-020, D-16)
import { describe, expect, it } from "vitest";
import type { Route, Stop } from "../../shared/domain";
import { findJourneys, indexRoutes, type Journey } from "../../src/route/engine";
import { explainJourney } from "../../src/route/explain";
import { sumTime, type RankedJourney } from "../../src/route/ranking";
import { journeySteps, stepPoints } from "../../src/route/steps";
import { journeyMapItems } from "../../src/stops/mapItems";
import { toMarkerInputs, markerHtml } from "../../src/map/markers";

// 가상 데이터
const S = (id: string, name: string, lat: number | null = 33.5): Stop => ({ id, name, coordinates: lat === null ? null : { lat, lng: 126.5 } });
const STOPS: Stop[] = [S("S1", "가상출발"), S("S2", "가상환승", null), S("S3", "가상도착"), S("S9", "가상종점")];
const ROUTES: Route[] = [
  { id: "A", name: "가상1번", subName: null, type: null, stopIds: ["S1", "S2"] },
  { id: "B", name: "가상2번", subName: null, type: null, stopIds: ["S2", "S3", "S9"] },
];
const stopsById = new Map(STOPS.map((s) => [s.id, s]));
const routesById = new Map(ROUTES.map((r) => [r.id, r]));
const result = findJourneys(indexRoutes(ROUTES, new Set(stopsById.keys())), [{ stopId: "S1", walkMeters: 120 }], [{ stopId: "S3", walkMeters: 80 }]);
const journey = (result.status === "ok" ? result.journeys[0] : null) as Journey;
const ranked = (over: Partial<RankedJourney> = {}): RankedJourney => ({ journey, totalTime: null, walkMinutes: null, walkMeters: journey.walkMeters, ...over });

describe("단계 안내 (AC-013)", () => {
  const steps = journeySteps(journey, stopsById, routesById);

  it("도보 → 승차 → 환승 → 승차 → 하차 → 도보 순서", () => {
    expect(steps.map((s) => s.kind)).toEqual(["walk_to_board", "board", "transfer", "board", "alight", "walk_to_destination"]);
  });

  it("모든 정류장명·노선명이 입력 데이터에 있는 값", () => {
    const names = new Set(STOPS.map((s) => s.name));
    const routeNames = new Set(ROUTES.map((r) => r.name));
    for (const step of steps) {
      for (const ref of Object.values(step).filter((v): v is { name: string | null } => typeof v === "object" && v !== null && "name" in v)) {
        expect(names.has(ref.name!)).toBe(true);
      }
      if (step.kind === "board") expect(routeNames.has(step.routeName!)).toBe(true);
    }
    expect(steps[3]).toMatchObject({ kind: "board", routeName: "가상2번", towards: { name: "가상종점" }, stopsToRide: 1 });
  });

  it("데이터에 없는 정류장·노선은 이름을 만들지 않고 null", () => {
    const missing = journeySteps(journey, new Map(), new Map());
    expect(missing[1]).toMatchObject({ kind: "board", stop: { id: "S1", name: null }, routeName: null, towards: null });
  });
});

describe("규칙 설명 (AC-018)", () => {
  it("소요시간·도보시간이 없으면 그 문장을 넣지 않는다", () => {
    const lines = explainJourney(ranked(), "time_unknown").join(" ");
    expect(lines).not.toMatch(/총 소요시간은|걷는 시간은/);
    expect(lines).toContain("1번 갈아탑니다");
  });

  it("값이 있으면 포함하고 추정은 '추정'으로 밝힌다", () => {
    const totalTime = sumTime([{ kind: "ride", minutes: 20, source: "estimated" }]);
    const lines = explainJourney(ranked({ totalTime, walkMinutes: 4 }), "recommended").join(" ");
    expect(lines).toContain("총 소요시간은 20분이며 추정값이 포함");
    expect(lines).toContain("걷는 시간은 4분");
  });

  it("네트워크 없이 생성(순수 함수, 생성형 AI 미사용)", () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("network blocked");
    };
    try {
      expect(explainJourney(ranked(), "time_unknown").length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("경로 지도 표시 (AC-020, D-16)", () => {
  const points = stepPoints(journey, stopsById);

  it("승차 1 → 환승 2 → 하차 3", () => {
    expect(points.map((p) => [p.number, p.role, p.stop.id])).toEqual([
      [1, "board", "S1"],
      [2, "transfer", "S2"],
      [3, "alight", "S3"],
    ]);
  });

  it("좌표 없는 지점(환승 S2)은 지도에서 빠지고 단계 목록에는 남는다, 마커에 단계 번호", () => {
    const markers = toMarkerInputs(journeyMapItems(points, { lat: 33.4, lng: 126.4 }, { lat: 33.6, lng: 126.6 }));
    expect(markers.filter((m) => m.kind === "step").map((m) => m.stepNumber)).toEqual([1, 3]);
    expect(markerHtml(markers.find((m) => m.stepNumber === 3)!, false)).toContain(">3<");
    expect(journeySteps(journey, stopsById, routesById).some((s) => s.kind === "transfer" && s.stop.id === "S2")).toBe(true);
  });

  it("지도 항목에 선(경로) 종류가 없다", () => {
    const kinds = new Set(journeyMapItems(points, null, null).map((i) => i.kind));
    expect([...kinds]).toEqual(["step"]);
  });
});
