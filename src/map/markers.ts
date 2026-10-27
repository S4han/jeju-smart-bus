// 지도 마커 입력 (TASK-010, AC-004·AC-020, D-24)
// 좌표가 확인된 항목만 마커가 된다. 좌표 없는 항목을 임의 위치에 그리지 않는다.

import type { Coordinates } from "../../shared/domain";

// kind가 없으면 SDK 기본 마커(PoC 그대로), origin·destination·stop은 서로 구분되는 모양으로 그린다(TASK-013·015)
export type MapItemKind = "origin" | "destination" | "stop" | "step" | "via" | "pick";

export interface MapItem {
  id: string;
  title: string;
  coordinates: Coordinates | null;
  kind?: MapItemKind;
  // 경로 단계 번호(kind "step", D-16)
  stepNumber?: number;
  // 흐리게 표시(지도에서 고르기 미리보기의 500m~1km 정류장 — TASK-034)
  muted?: boolean;
}

export interface MarkerInput {
  id: string;
  title: string;
  position: Coordinates;
  kind?: MapItemKind;
  stepNumber?: number;
  muted?: boolean;
}

export function toMarkerInputs(items: ReadonlyArray<MapItem>): MarkerInput[] {
  return items.flatMap((item) => (item.coordinates
      ? [
          {
            id: item.id,
            title: item.title,
            position: item.coordinates,
            ...(item.kind ? { kind: item.kind } : {}),
            ...(item.stepNumber !== undefined ? { stepNumber: item.stepNumber } : {}),
            ...(item.muted ? { muted: true } : {}),
          },
        ]
      : []));
}

// 정류장 이름은 외부 데이터(BIS)이므로 HTML로 넣기 전에 반드시 이스케이프한다
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const label = (text: string) => `<span class="map-marker-label">${escapeHtml(text)}</span>`;

// 마커 모양(HTML). 이름은 화면 낭독용 title로도 제공한다. 정류장·단계 마커는 점 오른쪽에 정류장 이름 표시(TASK-024)
export function markerHtml(input: MarkerInput, selected: boolean): string | null {
  if (input.kind === "origin") return '<div class="map-marker map-marker-origin" aria-hidden="true">출발</div>';
  if (input.kind === "destination") return '<div class="map-marker map-marker-destination" aria-hidden="true">도착</div>';
  if (input.kind === "step" && Number.isInteger(input.stepNumber))
    return `<div class="map-marker map-marker-step-wrap" aria-hidden="true"><div class="map-marker-step">${input.stepNumber}</div>${label(input.title.replace(/^\d+\.\s*/, ""))}</div>`;
  // 경유 정류장(TASK-029): 작은 흰 점 + 이름(축소하면 이름 숨김)
  if (input.kind === "via")
    return `<div class="map-marker map-marker-via-wrap" aria-hidden="true"><div class="map-marker-via"></div>${label(input.title)}</div>`;
  if (input.kind === "pick") return '<div class="map-marker map-marker-pick" aria-hidden="true"><span>📍</span></div>';
  if (input.kind === "stop")
    return `<div class="map-marker map-marker-stop-wrap${selected ? " is-selected" : ""}${input.muted ? " is-muted" : ""}" aria-hidden="true"><div class="map-marker-stop${selected ? " is-selected" : ""}"></div>${label(input.title)}</div>`;
  return null;
}
