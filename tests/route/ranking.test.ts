// 소요시간·정렬·결과 구성 (TASK-017, AC-010·AC-011·AC-012·AC-015, D-07)
import { describe, expect, it } from "vitest";
import type { Journey, Leg } from "../../src/route/engine";
import { findJourneys, indexRoutes } from "../../src/route/engine";
import {
  RECOMMENDED_LIMIT,
  TIME_UNKNOWN_LIMIT,
  UNVERIFIED_TIME,
  buildResultSections,
  compareRecommended,
  compareTimeUnknown,
  sumTime,
  type RankedJourney,
  type TimeEstimator,
} from "../../src/route/ranking";

const leg = (routeId: string, board: string, alight: string): Leg => ({ routeId, boardStopId: board, boardOrder: 1, alightStopId: alight, alightOrder: 2 });
const journey = (id: string, transfers: number, walkMeters = 100): Journey => ({
  id,
  legs: Array.from({ length: transfers + 1 }, (_, i) => leg(`R${i}`, `S${i}`, `S${i + 1}`)),
  transfers,
  originWalkMeters: walkMeters / 2,
  destinationWalkMeters: walkMeters / 2,
  walkMeters,
  rideStops: 1,
});
const timed = (id: string, minutes: number, transfers: number, walkMinutes: number): RankedJourney => ({
  journey: journey(id, transfers),
  totalTime: { minutes, estimated: false, components: [] },
  walkMinutes,
  walkMeters: 100,
});
const shuffle = <T,>(xs: T[]) => [...xs].reverse().sort((a, b) => (JSON.stringify(a).length % 3) - (JSON.stringify(b).length % 3));

describe("추천 정렬 (AC-011)", () => {
  const a = timed("A", 50, 0, 5);
  const b = timed("B", 50, 0, 12);
  const c = timed("C", 50, 1, 8);
  const d = timed("D", 55, 0, 1);

  it("PRD 예시: 50/0/5 → 50/0/12 → 50/1/8 → 55/0", () => {
    expect([d, c, b, a].sort(compareRecommended).map((r) => r.journey.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("입력 순서를 섞어도 같은 결과", () => {
    for (const input of [[a, b, c, d], [c, a, d, b], shuffle([a, b, c, d])]) {
      expect([...input].sort(compareRecommended).map((r) => r.journey.id)).toEqual(["A", "B", "C", "D"]);
    }
  });

  it("세 수치가 같으면 고정 식별자 코드 단위 순(로케일 비의존)", () => {
    const x = timed("R2:405>406", 50, 0, 5);
    const y = timed("R10:405>406", 50, 0, 5);
    const z = timed("r1:405>406", 50, 0, 5); // 소문자는 코드 단위로 대문자 뒤
    expect([z, x, y].sort(compareRecommended).map((r) => r.journey.id)).toEqual(["R10:405>406", "R2:405>406", "r1:405>406"]);
  });
});

describe("총 소요시간 합산 (AC-010)", () => {
  it("모든 구성요소가 있으면 합산, 추정이 하나라도 있으면 추정", () => {
    const t = sumTime([
      { kind: "walk", minutes: 5, source: "estimated" },
      { kind: "wait", minutes: 7, source: "realtime" },
      { kind: "ride", minutes: 20, source: "realtime" },
    ]);
    expect(t).toMatchObject({ minutes: 32, estimated: true });
  });

  it("하나라도 미검증(null)이면 미확인 — 임의 수치로 채우지 않는다", () => {
    expect(sumTime([{ kind: "wait", minutes: 7, source: "realtime" }, null])).toBeNull();
    expect(sumTime([])).toBeNull();
    expect(sumTime([{ kind: "ride", minutes: Number.NaN, source: "realtime" }])).toBeNull();
  });

  it("구성요소 하나 미검증 → 추천 영역에서 빠지고 시간 미확인 영역으로", () => {
    const js = [journey("A", 0), journey("B", 0)];
    const time: TimeEstimator = {
      totalTime: (j) => (j.id === "A" ? sumTime([{ kind: "ride", minutes: 10, source: "realtime" }]) : sumTime([null])),
      walkMinutes: () => 3,
    };
    const s = buildResultSections(js, time);
    expect(s.recommended.map((r) => r.journey.id)).toEqual(["A"]);
    expect(s.timeUnknown.map((r) => r.journey.id)).toEqual(["B"]);
    expect(s.timeUnknown[0].totalTime).toBeNull();
  });
});

describe("상한 (AC-012·AC-015)", () => {
  const always: TimeEstimator = { totalTime: () => sumTime([{ kind: "ride", minutes: 10, source: "realtime" }]), walkMinutes: () => 1 };

  it("시간 확인 경로 4개 이상 → 3개, 2개 → 2개", () => {
    expect(RECOMMENDED_LIMIT).toBe(3);
    expect(buildResultSections(["A", "B", "C", "D"].map((id) => journey(id, 0)), always).recommended).toHaveLength(3);
    expect(buildResultSections(["A", "B"].map((id) => journey(id, 0)), always).recommended).toHaveLength(2);
  });

  it("시간 미확인 6개 이상 → 5개", () => {
    expect(TIME_UNKNOWN_LIMIT).toBe(5);
    expect(buildResultSections(["A", "B", "C", "D", "E", "F"].map((id) => journey(id, 0))).timeUnknown).toHaveLength(5);
  });
});

describe("시간 미확인 정렬 (AC-015)", () => {
  const r = (id: string, transfers: number, walkMeters: number | null): RankedJourney => ({ journey: journey(id, transfers), totalTime: null, walkMinutes: null, walkMeters });

  it("환승 오름차순 → 도보거리 확인 가능 우선 → 거리 → 식별자", () => {
    const list = [r("Z", 1, 50), r("Y", 0, null), r("X", 0, 300), r("W", 0, 100), r("V", 0, 100), r("U", 0, null)];
    expect([...list].sort(compareTimeUnknown).map((x) => x.journey.id)).toEqual(["V", "W", "X", "U", "Y", "Z"]);
  });

  it("GATE-05·D-06 확정 전에는 모든 경로가 시간 미확인 영역, 추천 영역은 비어 있다", () => {
    const s = buildResultSections([journey("A", 0), journey("B", 1)], UNVERIFIED_TIME);
    expect(s.recommended).toEqual([]);
    expect(s.timeUnknown.map((x) => x.journey.id)).toEqual(["A", "B"]);
  });
});

describe("고정 식별자 (D-07)", () => {
  const STOPS = new Set(["405001", "405050", "405120", "406010"]);
  const route = (id: string, stopIds: string[]) => ({ id, name: id, subName: null, type: null, stopIds });

  it("직행 `노선:승차>하차`, 환승은 탑승 순서대로 `|` 연결 — 같은 입력이면 같은 문자열", () => {
    const routes = [route("201", ["405001", "405050", "405120"]), route("311", ["405050", "406010"])];
    const run = (dest: string) => findJourneys(indexRoutes(routes, STOPS), [{ stopId: "405001", walkMeters: 10 }], [{ stopId: dest, walkMeters: 10 }]);
    const ids = (r: ReturnType<typeof run>) => (r.status === "ok" ? r.journeys.map((j) => j.id) : []);
    expect(ids(run("405120"))).toEqual(["201:405001>405120"]);
    expect(ids(run("406010"))).toEqual(["201:405001>405050|311:405050>406010"]);
    expect(ids(run("406010"))).toEqual(ids(run("406010")));
  });
});
