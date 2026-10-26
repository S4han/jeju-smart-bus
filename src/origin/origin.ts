// 출발지 모델 (TASK-011, FR-001·FR-002, AC-001·AC-002)
// 출발지는 확인된 좌표가 있을 때만 존재한다. 입력만 하고 선택하지 않은 텍스트는 출발지가 아니다.

import type { Coordinates, Stop, StopId } from "../../shared/domain";
import { isValidCoordinates } from "./geolocation";

export type Origin =
  | { kind: "current_location"; coordinates: Coordinates }
  | { kind: "stop"; stopId: StopId; name: string; coordinates: Coordinates }
  // 지도에서 고른 지점 — 장소명은 만들지 않는다(역지오코딩 미사용, D-05)
  | { kind: "map_point"; coordinates: Coordinates };

export function originFromCurrentLocation(coordinates: Coordinates): Origin | null {
  return isValidCoordinates(coordinates) ? { kind: "current_location", coordinates } : null;
}

// 좌표 확인 불가 정류장(D-24)은 출발지가 될 수 없다
export function originFromStop(stop: Stop): Origin | null {
  return stop.coordinates && isValidCoordinates(stop.coordinates)
    ? { kind: "stop", stopId: stop.id, name: stop.name, coordinates: stop.coordinates }
    : null;
}

export function originFromMapPoint(coordinates: Coordinates): Origin | null {
  return isValidCoordinates(coordinates) ? { kind: "map_point", coordinates } : null;
}

// AC-002: 선택이 끝난 출발지가 있을 때만 정류장·경로 검색을 시작할 수 있다
export function canStartSearch(origin: Origin | null): origin is Origin {
  return origin !== null;
}

export function describeOrigin(origin: Origin): string {
  switch (origin.kind) {
    case "current_location":
      return "현재 위치";
    case "stop":
      return `정류장: ${origin.name}`;
    case "map_point":
      return "지도에서 고른 지점";
  }
}
