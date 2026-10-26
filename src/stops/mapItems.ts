// 지도에 그릴 항목 (TASK-013, FR-004·FR-020, AC-004·AC-020)
// 목록과 같은 결과 상태에서만 만든다 — 지도용으로 따로 거르지 않는다. 정류장 사이 선은 그리지 않는다(D-16)

import type { Coordinates } from "../../shared/domain";
import type { MapItem } from "../map/markers";
import type { NearbyState } from "./nearby";

export const ORIGIN_ITEM_ID = "origin";
export const DESTINATION_ITEM_ID = "destination";

export function nearbyStopsOf(state: NearbyState | null) {
  return state?.phase === "results" ? state.stops : [];
}

// 출발지·목적지 지점과 출발지 주변 정류장(목록과 같은 집합). 목적지 후보 정류장은 지도에 따로 그리지 않는다
export function nearbyMapItems(state: NearbyState | null, origin: Coordinates | null, destination: Coordinates | null = null): MapItem[] {
  return [
    ...(origin ? [{ id: ORIGIN_ITEM_ID, title: "출발지", coordinates: origin, kind: "origin" } satisfies MapItem] : []),
    ...(destination ? [{ id: DESTINATION_ITEM_ID, title: "목적지", coordinates: destination, kind: "destination" } satisfies MapItem] : []),
    ...nearbyStopsOf(state).map(({ stop }): MapItem => ({ id: stop.id, title: stop.name, coordinates: stop.coordinates, kind: "stop" })),
  ];
}

// 지도가 보여 줄 범위: 출발지와 결과 정류장을 모두 담는 사각형
export function boundsOf(points: ReadonlyArray<Coordinates>): { sw: Coordinates; ne: Coordinates } | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    sw: { lat: Math.min(...lats), lng: Math.min(...lngs) },
    ne: { lat: Math.max(...lats), lng: Math.max(...lngs) },
  };
}
