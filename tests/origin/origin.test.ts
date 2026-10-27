// 출발지 모델·정류장명 검색 (TASK-011, FR-001·FR-002, AC-001·AC-002, D-05·D-24)
import { describe, expect, it } from "vitest";
import type { Stop } from "../../shared/domain";
import {
  canStartSearch,
  describeOrigin,
  originFromCurrentLocation,
  originFromMapPoint,
  originFromStop,
} from "../../src/origin/origin";
import { nextStopNames, normalizeStopName, searchStops } from "../../src/origin/stopSearch";

// 테스트용 가상 정류장(실제 데이터 아님)
const STOPS: Stop[] = [
  { id: "T3", name: "가상 시청앞", coordinates: { lat: 33.49, lng: 126.53 } },
  { id: "T1", name: "가상시청", coordinates: { lat: 33.5, lng: 126.52 } },
  { id: "T2", name: "가상시청", coordinates: null },
  { id: "T4", name: "북쪽 가상시청 입구", coordinates: { lat: 33.51, lng: 126.54 } },
  { id: "T5", name: "다른 정류장", coordinates: { lat: 33.4, lng: 126.6 } },
];

describe("출발지", () => {
  it("현재 위치 좌표 → 현재 위치 출발지, 검색 시작 가능 (AC-001)", () => {
    const origin = originFromCurrentLocation({ lat: 33.5, lng: 126.5 });
    expect(origin).toEqual({ kind: "current_location", coordinates: { lat: 33.5, lng: 126.5 } });
    expect(canStartSearch(origin)).toBe(true);
    expect(describeOrigin(origin!)).toBe("현재 위치");
  });

  it("위치 실패·미선택 → 출발지 없음, 검색 미시작 (AC-001·AC-002)", () => {
    expect(canStartSearch(null)).toBe(false);
    expect(originFromCurrentLocation({ lat: Number.NaN, lng: 0 })).toBeNull();
  });

  it("목록에서 고른 정류장 → 정류장 출발지 (AC-002)", () => {
    const origin = originFromStop(STOPS[1]);
    expect(origin).toEqual({ kind: "stop", stopId: "T1", name: "가상시청", coordinates: { lat: 33.5, lng: 126.52 } });
    expect(canStartSearch(origin)).toBe(true);
    expect(describeOrigin(origin!)).toBe("정류장: 가상시청");
  });

  it("좌표 확인 불가 정류장은 출발지가 될 수 없다 (D-24, AC-002)", () => {
    expect(originFromStop(STOPS[2])).toBeNull();
  });

  it("지도에서 고른 지점 → 장소명 없이 좌표만 (D-05)", () => {
    const origin = originFromMapPoint({ lat: 33.45, lng: 126.56 });
    expect(origin).toEqual({ kind: "map_point", coordinates: { lat: 33.45, lng: 126.56 } });
    expect(describeOrigin(origin!)).toBe("지도에서 고른 지점");
    expect(originFromMapPoint({ lat: 100, lng: 0 })).toBeNull();
  });
});

describe("정류장 이름 검색", () => {
  it("공백·대소문자 무시 부분 일치, 앞부분 일치·짧은 이름 우선", () => {
    const ids = searchStops(STOPS, " 가상 시청 ").map((r) => r.stop.id);
    expect(ids).toEqual(["T1", "T2", "T3", "T4"]);
    expect(normalizeStopName("A b  C")).toBe("abc");
  });

  it("좌표 없는 정류장은 목록에 보이되 선택 불가 (D-24)", () => {
    const results = searchStops(STOPS, "가상시청");
    expect(results.find((r) => r.stop.id === "T2")?.selectable).toBe(false);
    expect(results.find((r) => r.stop.id === "T1")?.selectable).toBe(true);
  });

  it("빈 검색어·일치 없음 → 결과 없음, 텍스트만으로는 출발지가 생기지 않는다 (AC-002)", () => {
    expect(searchStops(STOPS, "   ")).toEqual([]);
    expect(searchStops(STOPS, "없는이름")).toEqual([]);
  });

  it("결과 개수 제한", () => {
    expect(searchStops(STOPS, "가상", 2)).toHaveLength(2);
  });
});

// 검색 보완·방향 힌트(TASK-028)

describe("정류장 검색 보완 (TASK-028)", () => {
  const S = (id: string, name: string) => ({ id, name, coordinates: { lat: 33.5, lng: 126.5 } });
  const stops = [S("1", "제주국제공항1(표선,성산,남원)"), S("2", "공항초소"), S("3", "제주시청")];
  it("부분 일치가 없으면 글자 순서 포함으로 찾음: 제주공항 → 제주국제공항", () => {
    expect(searchStops(stops, "제주공항").map((r) => r.stop.id)).toEqual(["1"]);
  });
  it("부분 일치가 있으면 순서 포함 결과를 섞지 않음", () => {
    expect(searchStops(stops, "공항").map((r) => r.stop.id)).toEqual(["2", "1"]);
  });
  it("두 글자 이하는 순서 포함 검색을 하지 않음", () => {
    expect(searchStops(stops, "제항")).toEqual([]);
  });
  it("다음 정류장 이름(방향 힌트)은 노선 정차 순서에서만 만든다", () => {
    const all = [S("A", "정존마을"), S("B", "정존마을"), S("C", "노형오거리"), S("D", "신제주로터리")];
    const byId = new Map(all.map((s) => [s.id, s] as const));
    const routes = [
      { id: "r1", name: "1", subName: "", type: "", stopIds: ["A", "C"] },
      { id: "r2", name: "2", subName: "", type: "", stopIds: ["D", "B"] },
    ];
    const next = nextStopNames(routes, byId);
    expect(next.get("A")).toEqual(["노형오거리"]);
    expect(next.get("B")).toBeUndefined();
    expect(next.get("D")).toEqual(["정존마을"]);
  });
});
