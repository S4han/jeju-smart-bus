// 지도 마커 입력 (TASK-010, AC-004·AC-020, D-24)
// 좌표가 확인된 항목만 마커가 된다. 좌표 없는 항목을 임의 위치에 그리지 않는다.

import type { Coordinates } from "../../shared/domain";

export interface MapItem {
  id: string;
  title: string;
  coordinates: Coordinates | null;
}

export interface MarkerInput {
  id: string;
  title: string;
  position: Coordinates;
}

export function toMarkerInputs(items: ReadonlyArray<MapItem>): MarkerInput[] {
  return items.flatMap((item) => (item.coordinates ? [{ id: item.id, title: item.title, position: item.coordinates }] : []));
}
