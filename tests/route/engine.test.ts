// 경로 탐색 엔진 (TASK-016, FR-008·FR-009·FR-016, AC-008·AC-009·AC-016, D-19·D-21)
import { describe, expect, it } from "vitest";
import type { Route } from "../../shared/domain";
import { MAX_TRANSFERS, findJourneys, indexRoutes, type Candidate, type Journey } from "../../src/route/engine";

// 가상 정류장 S1..S20, 가상 노선
const route = (id: string, stopIds: string[]): Route => ({ id, name: id, subName: null, type: null, stopIds });
const STOPS = new Set(Array.from({ length: 20 }, (_, i) => `S${i + 1}`));
const at = (stopId: string, walkMeters = 100): Candidate => ({ stopId, walkMeters });
const search = (routes: Route[], o: Candidate[], d: Candidate[], limit?: number) => findJourneys(indexRoutes(routes, STOPS), o, d, limit);
const journeys = (r: ReturnType<typeof search>): Journey[] => (r.status === "ok" ? r.journeys : []);
const ids = (r: ReturnType<typeof search>) => journeys(r).map((j) => j.id);

describe("직행 (AC-008)", () => {
  const R = route("R1", ["S1", "S2", "S3", "S4"]);

  it("정방향(승차 순번 < 하차 순번)만 직행", () => {
    expect(ids(search([R], [at("S1")], [at("S3")]))).toEqual(["R1:1-3"]);
  });

  it("역방향은 제외 → 경로 없음", () => {
    expect(search([R], [at("S3")], [at("S1")])).toEqual({ status: "empty", reason: "no_route" });
  });

  it("방향이 다른 노선(다른 routeId)은 각자의 순서로만 판단", () => {
    const back = route("R1b", ["S4", "S3", "S2", "S1"]);
    expect(ids(search([R, back], [at("S3")], [at("S1")]))).toEqual(["R1b:2-4"]);
  });
});

describe("순환·반복 정류장 (D-21)", () => {
  it("끝 → 처음 넘김은 허용하지 않는다", () => {
    const loop = route("L", ["S1", "S2", "S3", "S4", "S1"]);
    // S4에서 S2로 가려면 끝(S1)을 지나 처음으로 넘어가야 함
    expect(search([loop], [at("S4")], [at("S2")]).status).toBe("empty");
    // S4 → S1(마지막 순번)은 정방향
    expect(ids(search([loop], [at("S4")], [at("S1")]))).toEqual(["L:4-5"]);
  });

  it("같은 정류장이 두 순번에 있으면 순번 차이가 가장 작은 조합 하나만", () => {
    const r = route("R", ["S1", "S2", "S3", "S1", "S5", "S6"]);
    expect(ids(search([r], [at("S1")], [at("S6")]))).toEqual(["R:4-6"]);
  });
});

describe("환승 (AC-009, D-19)", () => {
  const A = route("A", ["S1", "S2", "S3"]);
  const B = route("B", ["S3", "S4", "S5"]);
  const C = route("C", ["S5", "S6", "S7"]);
  const D = route("D", ["S7", "S8", "S9"]);

  it("1회 환승: 같은 정류장 ID에서만", () => {
    const r = search([A, B], [at("S1")], [at("S5")]);
    expect(ids(r)).toEqual(["A:1-3|B:1-3"]);
    expect(journeys(r)[0].legs[0].alightStopId).toBe(journeys(r)[0].legs[1].boardStopId);
  });

  it("길 맞은편(다른 ID) 정류장 사이는 환승을 만들지 않는다", () => {
    const B2 = route("B2", ["S13", "S4", "S5"]); // S3의 맞은편이 S13이라고 가정
    expect(search([A, B2], [at("S1")], [at("S5")]).status).toBe("empty");
  });

  it("2회 환승 경로: 각 구간이 정방향이고 환승 정류장이 이어진다", () => {
    const j = journeys(search([A, B, C], [at("S1")], [at("S7")]));
    expect(j.map((x) => x.id)).toEqual(["A:1-3|B:1-3|C:1-3"]);
    expect(j[0].transfers).toBe(2);
  });

  it("3회 환승이 필요한 입력 → 결과 없음 (상한 2)", () => {
    expect(MAX_TRANSFERS).toBe(2);
    expect(search([A, B, C, D], [at("S1")], [at("S9")])).toEqual({ status: "empty", reason: "no_route" });
  });

  it("환승 구간 중 하나라도 역방향이면 제외", () => {
    const Brev = route("Brev", ["S5", "S4", "S3"]);
    expect(search([A, Brev], [at("S1")], [at("S5")]).status).toBe("empty");
  });

  it("같은 노선으로 다시 갈아타는 조합은 만들지 않는다", () => {
    const r = search([A], [at("S1")], [at("S3")]);
    expect(journeys(r).every((j) => j.transfers === 0)).toBe(true);
  });
});

describe("결과 정리·결정성", () => {
  const A = route("A", ["S1", "S2", "S3", "S4"]);
  const A2 = route("A2", ["S11", "S2", "S3", "S4"]);
  const B = route("B", ["S2", "S10", "S4"]);

  it("같은 노선 조합은 대표 하나(걷기 → 탄 정류장 수), 환승 적은 순·걷기 짧은 순", () => {
    const r = search([A, A2, B], [at("S1", 300), at("S2", 100), at("S11", 50)], [at("S4", 80)]);
    const j = journeys(r);
    expect(j.map((x) => x.id)).toEqual(["A2:1-4", "A:2-4", "B:1-3"]);
    expect(j.map((x) => x.walkMeters)).toEqual([130, 180, 180]);
  });

  it("입력 순서를 바꿔도 결과가 같다", () => {
    const o = [at("S1", 300), at("S2", 100), at("S11", 50)];
    const a = search([A, A2, B], o, [at("S4", 80)]);
    const b = search([B, A2, A], [...o].reverse(), [at("S4", 80)]);
    expect(b).toEqual(a);
  });

  it("환승 횟수별 상한", () => {
    const routes = Array.from({ length: 5 }, (_, i) => route(`X${i}`, ["S1", `S${i + 2}`, "S20"]));
    expect(journeys(search(routes, [at("S1")], [at("S20")], 3))).toHaveLength(3);
  });
});

describe("데이터 불일치 (AC-016)", () => {
  it("정류장 목록에 없는 정류장을 가진 노선은 제외하고, 후보에 닿는 노선이 그것뿐이면 data_unavailable", () => {
    const broken = route("BAD", ["S1", "UNKNOWN", "S3"]);
    expect(search([broken], [at("S1")], [at("S3")])).toEqual({ status: "empty", reason: "data_unavailable" });
  });

  it("정류장 1개짜리 노선은 제외", () => {
    expect(search([route("ONE", ["S1"])], [at("S1")], [at("S1")]).status).toBe("empty");
  });
});
