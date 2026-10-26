// 지도 마커 입력 (TASK-010, AC-004·AC-020, D-24)
// 좌표가 확인된 항목만 마커가 된다. 좌표 없는 항목을 임의 위치에 그리지 않는다.

import type { Coordinates } from "../../shared/domain";

// kind가 없으면 SDK 기본 마커(PoC 그대로), origin·stop은 서로 구분되는 모양으로 그린다(TASK-013)
export type MapItemKind = "origin" | "stop";

export interface MapItem {
  id: string;
  title: string;
  coordinates: Coordinates | null;
  kind?: MapItemKind;
}

export interface MarkerInput {
  id: string;
  title: string;
  position: Coordinates;
  kind?: MapItemKind;
}

export function toMarkerInputs(items: ReadonlyArray<MapItem>): MarkerInput[] {
  return items.flatMap((item) => (item.coordinates ? [{ id: item.id, title: item.title, position: item.coordinates, ...(item.kind ? { kind: item.kind } : {}) }] : []));
}

// 마커 모양(HTML). 이름은 화면 낭독용 title로도 제공한다
export function markerHtml(input: MarkerInput, selected: boolean): string | null {
  if (input.kind === "origin") return '<div class="map-marker map-marker-origin" aria-hidden="true">출발</div>';
  if (input.kind === "stop") return `<div class="map-marker map-marker-stop${selected ? " is-selected" : ""}" aria-hidden="true"></div>`;
  return null;
}
