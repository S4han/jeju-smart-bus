// 장애 영향 안내 (TASK-019, AC-017)
import { describe, expect, it } from "vitest";
import { describeImpact, impactNotice } from "../../src/service/impact";

describe("기능별 영향", () => {
  it("도착정보 장애 → 도착정보만 이용 불가, 정류장 검색·주변·경로·지도는 유지", () => {
    const n = impactNotice("bus_arrivals", "unavailable");
    expect(n.affected).toEqual(["arrivals"]);
    expect(n.available).toEqual(["map", "map_pick", "stop_search", "nearby", "route_search"]);
    expect(describeImpact(n)).toContain("정류장 이름 검색");
  });

  it("지도 장애(로드 실패·한도 도달 차단) → 지도·지도 지정만 불가, 목록 기반 기능 유지", () => {
    const n = impactNotice("naver_maps", "unavailable");
    expect(n.affected).toEqual(["map", "map_pick"]);
    expect(n.available).toEqual(["stop_search", "nearby", "route_search", "arrivals"]);
  });

  it("정류장 자료 장애 → 검색·주변·경로·도착정보 불가, 지도는 유지", () => {
    expect(impactNotice("snapshot", "unavailable").available).toEqual(["map", "map_pick"]);
  });

  it("여러 서비스가 함께 멈추면 계속 쓸 수 있는 기능에서 모두 뺀다", () => {
    expect(impactNotice("bus_arrivals", "quota_exhausted", ["naver_maps", "bus_arrivals"]).available).toEqual(["stop_search", "nearby", "route_search"]);
  });

  it("원인별 문구", () => {
    expect(impactNotice("bus_arrivals", "quota_exhausted").message).toContain("이용 한도에 도달");
    expect(impactNotice("bus_arrivals", "rate_limited").message).toContain("요청이 많아");
  });
});
