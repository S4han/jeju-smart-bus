// TASK-006 정합성 분석 (GATE-02·03)
import { describe, expect, it } from "vitest";
import { haversineMeters, nearbyStationStats, outOfRangeStations, routeIntegrity } from "../../server/bis-analysis";

const st = (id: string, nm: string, x: string, y: string, useYn = "Y") => ({ stationId: id, stationNm: nm, localX: x, localY: y, useYn, dirTp: "N" });
const sr = (route: string, station: string, ord: number, dir = "0", dist = ord * 100) => ({
  routeId: route, stationId: station, stationOrd: String(ord), updnDir: dir, routeDist: String(dist), useYn: "Y",
});

describe("routeIntegrity", () => {
  const stations = [st("1", "A", "126.5", "33.5"), st("2", "B", "126.51", "33.5"), st("3", "C", "33.5", "126.5"), st("4", "D", "126.52", "33.5", "N")];
  const buses = [
    { routeId: "R1", useYn: "Y", stationCnt: "3", orgtStationId: "1", dstStationId: "2" },
    { routeId: "R2", useYn: "Y", stationCnt: "2" },
    { routeId: "R3", useYn: "Y" },
    { routeId: "R4", useYn: "N" },
  ];
  const mapping = [
    sr("R1", "1", 1), sr("R1", "2", 2, "1"), sr("R1", "1", 3, "1"),
    sr("R2", "3", 1), sr("R2", "9", 3, "0", 50), sr("R2", "4", 3),
    sr("R5", "1", 1),
  ];
  const r = routeIntegrity(stations, buses, mapping);

  it("총계와 방향 분포", () => {
    expect(r.totals).toMatchObject({ activeRoutes: 3, mappingRows: 7, mappingRoutes: 3, activeMappingRows: 6 });
    expect(r.direction).toEqual({ allZero: 1, allOne: 0, both: 1, other: 0 });
    expect(r.circularFirstEqualsLast).toBe(1);
    expect(r.routesWithRepeatedStation).toBe(1);
  });

  it("정합성 문제를 노선 단위로 센다", () => {
    expect(r.issueCounts).toMatchObject({
      activeRoutesWithoutMapping: 1,
      mappingRoutesNotInBus: 1,
      ordDuplicate: 1,
      ordGap: 1,
      stationMissingInStationList: 1,
      stationNotInUse: 1,
      stationCoordinatesInvalid: 1,
      stationCntMismatch: 1,
      routeDistDecreasing: 1,
    });
    expect(r.issueExamples.activeRoutesWithoutMapping).toEqual(["R3"]);
  });
});

describe("stations", () => {
  it("범위 밖 정류장은 그대로 나열하고, 같은 이름 근접 정류장을 센다", () => {
    const stations = [st("1", "A", "126.5", "33.5"), st("2", "A", "126.5003", "33.5"), st("3", "B", "126.3", "33.96")];
    expect(outOfRangeStations(stations).map((s) => s.stationId)).toEqual(["3"]);
    const n = nearbyStationStats(stations);
    expect(n.sameNameGroups).toBe(1);
    expect(n.sameNameNearestDistance.le30m).toBe(2);
    expect(n.differentIdPairs.within30m).toBe(1);
  });

  it("하버사인 거리", () => {
    expect(Math.round(haversineMeters(33.5, 126.5, 33.5, 126.5003))).toBe(28);
  });
});
