// 도메인 변환·스냅샷 가공 규칙 (TASK-009, D-24·D-26, NFR-004, AC-004·AC-005·AC-020)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshot, parseBisDateTime, toArrival, toCoordinates, toStop, type RawRecord } from "../../shared/bis-convert";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(`tests/fixtures/bis/${name}`, "utf8"));

describe("좌표 (D-24·D-26)", () => {
  it("제주 본섬과 추자도 좌표만 유효하다", () => {
    expect(toCoordinates("126.514", "33.499974")).toEqual({ lat: 33.499974, lng: 126.514 });
    expect(toCoordinates("126.29614", "33.960502")).toEqual({ lat: 33.960502, lng: 126.29614 });
  });

  it("뒤바뀐 좌표는 보정하지 않고 확인 불가로 둔다", () => {
    // 실측 406002082 색달동(야크마을)
    expect(toCoordinates("33.265967", "126.415368")).toBeNull();
  });

  it("빈 값·문자열 null·숫자 아님·범위 밖은 확인 불가", () => {
    for (const [x, y] of [["", "33.5"], ["null", "33.5"], ["abc", "33.5"], ["127.5", "37.5"], ["0", "0"]]) {
      expect(toCoordinates(x, y)).toBeNull();
    }
  });
});

describe("정류장 변환", () => {
  it("실응답 정류장은 이름·ID와 확인된 좌표만 가진다", () => {
    const [, , terminal] = fixture<RawRecord[]>("station-items.json");
    expect(toStop(terminal)).toEqual({ id: "405000153", name: "제주버스터미널", coordinates: { lat: 33.499974, lng: 126.514 } });
  });

  it("좌표가 없어도 정류장은 남기되 좌표 있음으로 바꾸지 않는다", () => {
    expect(toStop({ stationId: "1", stationNm: "A", localX: "", localY: "" })).toEqual({ id: "1", name: "A", coordinates: null });
  });

  it("ID·이름이 없으면 만들지 않는다", () => {
    expect(toStop({ stationId: "1", stationNm: "null" })).toBeNull();
    expect(toStop({ stationNm: "A" })).toBeNull();
  });
});

describe("도착정보 변환", () => {
  const { items, staleExampleItems } = fixture<{ items: RawRecord[]; staleExampleItems: RawRecord[] }>("bus-arrives-items.json");

  it("차량이 있는 행은 실시간 값과 산출 시각을 그대로 옮긴다", () => {
    expect(toArrival(items[0])).toEqual({
      routeId: "405320114",
      stopOrder: 24,
      vehicleId: "7983228",
      minutesToArrival: 25,
      stopsAway: 21,
      calculatedAt: "2026-10-26T07:03:20.000Z",
      source: "realtime",
    });
  });

  it("arrvVhId=0이면 차량·시간을 만들지 않는다", () => {
    expect(toArrival(items[1])).toMatchObject({ vehicleId: null, minutesToArrival: null, stopsAway: null });
  });

  it("오래된 행도 변환은 하되 산출 시각을 보존한다(신선도는 TASK-014)", () => {
    expect(toArrival(staleExampleItems[1])?.calculatedAt).toBe("2025-05-08T08:44:48.000Z");
  });

  it("필수 값이 없거나 형식이 틀리면 버린다", () => {
    const base = items[0];
    expect(toArrival({ ...base, calcDate: undefined })).toBeNull();
    expect(toArrival({ ...base, calcDate: "어제" })).toBeNull();
    expect(toArrival({ ...base, stationOrd: "0" })).toBeNull();
    expect(toArrival({ ...base, routeId: "null" })).toBeNull();
  });
});

describe("BIS 일시 해석 (D-04)", () => {
  const kst = "2026-10-26T07:03:20.000Z";
  it.each(["2026-10-26T16:03:20+09:00", "2026-10-26 16:03:20", "2026-10-26T16:03:20", "20261026160320"])(
    "%s → 한국 시간으로 해석",
    (v) => expect(new Date(parseBisDateTime(v)!).toISOString()).toBe(kst),
  );
  it.each([undefined, "", "null", "어제", "2026-13-01 00:00:00", "2026-10-26 25:00:00", "16:03:20"])("%s → null", (v) => {
    expect(parseBisDateTime(v)).toBeNull();
  });
});

describe("스냅샷 (D-26)", () => {
  const stations: RawRecord[] = [
    { stationId: "A", stationNm: "가", localX: "126.5", localY: "33.5", useYn: "Y", upd: "2026-10-24 14:13:56" },
    { stationId: "B", stationNm: "나", localX: "126.51", localY: "33.5", useYn: "Y" },
    { stationId: "C", stationNm: "다", localX: "33.5", localY: "126.5", useYn: "Y" },
    { stationId: "D", stationNm: "라", localX: "126.52", localY: "33.5", useYn: "N" },
  ];
  const buses: RawRecord[] = [
    { routeId: "R1", routeNm: "201", routeSubNm: "null", routeTp: "13", useYn: "Y" },
    { routeId: "R2", routeNm: "202", useYn: "A" },
    { routeId: "R3", routeNm: "가상", useYn: "Y" },
    { routeId: "R4", routeNm: "204", useYn: "Y" },
    { routeId: "R5", routeNm: "205", useYn: "Y" },
    { routeId: "R6", routeNm: "206", useYn: "Y" },
  ];
  const row = (routeId: string, stationId: string, ord: number, useYn = "Y") => ({ routeId, stationId, stationOrd: String(ord), updnDir: "1", useYn });
  const stationRoutes: RawRecord[] = [
    row("R1", "B", 2), row("R1", "A", 1), row("R1", "C", 3), row("R1", "D", 9, "N"),
    row("R2", "A", 1), row("R2", "B", 2),
    row("R3", "A", 1),
    row("R4", "A", 1), row("R4", "B", 3),
    row("R5", "A", 1), row("R5", "D", 2),
  ];
  const { snapshot, stats } = buildSnapshot(stations, buses, stationRoutes, "2026-10-26T00:00:00Z");

  it("사용 중 정류장만, 뒤바뀐 좌표 정류장은 좌표 없이 포함", () => {
    expect(snapshot.stops.map((s) => s.id)).toEqual(["A", "B", "C"]);
    expect(snapshot.stops[2].coordinates).toBeNull();
    expect(stats.stops).toEqual({ included: 3, notInUse: 1, invalidRecord: 0, coordinatesUnavailable: 1 });
  });

  it("노선은 사용 중 매핑 행을 순번대로, 방향 필드는 쓰지 않는다", () => {
    expect(snapshot.routes).toEqual([{ id: "R1", name: "201", subName: null, type: "13", stopIds: ["A", "B", "C"] }]);
  });

  it("제외 사유를 센다: A=미사용, 정류장 1개, 순번 빠짐, 미사용 정류장 참조, 매핑 없음", () => {
    expect(stats.routes).toEqual({
      included: 1,
      notInUse: 1,
      invalidRecord: 0,
      singleStopOrLess: 1,
      noMapping: 1,
      inconsistentOrder: 1,
      unknownStop: 1,
    });
    expect(stats.routeStopRows).toBe(3);
    expect(snapshot.sourceUpdatedAt).toBe("2026-10-24 14:13:56");
  });
});
