// NAVER 지도 컴포넌트 (TASK-010, FR-004·FR-020 기반)
// SDK 로드 상태는 부모가 관리하고, 이 컴포넌트는 준비된 SDK로 지도와 마커만 그린다.

import { useEffect, useRef } from "react";
import type { Coordinates } from "../../shared/domain";
import { labelBoxFor, markerHtml, pickVisibleLabels, toMarkerInputs, type MapItem, type MarkerInput } from "./markers";

interface NaverMapProps {
  maps: typeof naver.maps | null;
  center: Coordinates;
  zoom: number;
  items: ReadonlyArray<MapItem>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  // 지도를 누른 지점(TASK-011 지도 직접 지정). 좌표는 부모 메모리 상태로만 전달한다
  onMapClick?: (coordinates: Coordinates) => void;
  // 바뀔 때마다 이 범위가 보이도록 지도를 맞춘다(null이면 그대로). TASK-013
  fitBounds?: { sw: Coordinates; ne: Coordinates } | null;
  // 지도 위에 떠 있는 요소(출발·도착 카드 등)를 피해 맞출 여백(px). TASK-022
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  // 선택한 정류장 등 보여 줘야 할 지점. 화면(여백 안) 밖에 있을 때만 지도를 옮긴다(TASK-025)
  focus?: Coordinates | null;
  // 정류장 순서 연결선(D-33) — 실제 도로 궤적이 아니므로 부모가 "실제 도로 경로 아님" 표기를 함께 보여 준다
  stopPaths?: ReadonlyArray<ReadonlyArray<Coordinates>>;
  ariaLabel: string;
}

// 이보다 멀리 축소하면 정류장 이름을 숨긴다 — 이름끼리 겹쳐 읽을 수 없게 되는 것을 막는다(TASK-024)
export const LABEL_MIN_ZOOM = 15;

const NO_PATHS: ReadonlyArray<ReadonlyArray<Coordinates>> = [];
// 내비게이션처럼 붉은 선(사용자 요청, D-33). 마커보다 아래에 그린다
const STOP_PATH_STYLE = { strokeColor: "#f04452", strokeWeight: 6, strokeOpacity: 0.85, strokeLineCap: "round", strokeLineJoin: "round", zIndex: 5 } as const;

// 지도 아래쪽 NAVER 로고·"© NAVER Corp."·축척이 있는 띠 높이(px) — 이름 라벨을 두지 않는다
const ATTRIBUTION_STRIP_PX = 44;

const DEFAULT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

export function NaverMap({ maps, center, zoom, items, selectedId = null, onSelect, onMapClick, fitBounds = null, fitPadding = DEFAULT_PADDING, focus = null, stopPaths = NO_PATHS, ariaLabel }: NaverMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<Array<{ marker: naver.maps.Marker; input: MarkerInput }>>([]);

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    mapRef.current = new maps.Map(container.current, { center: new maps.LatLng(center.lat, center.lng), zoom });
  }, [maps, center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    const markers = toMarkerInputs(items).map((input) => {
      const selected = input.id === selectedId;
      const html = markerHtml(input, selected);
      const marker = new maps.Marker({
        position: new maps.LatLng(input.position.lat, input.position.lng),
        map,
        title: input.title,
        zIndex: selected ? 100 : input.kind === "bus" ? 95 : input.kind === "pick" ? 90 : input.kind === "step" ? 60 : input.kind === "via" ? 10 : input.kind === "origin" || input.kind === "destination" ? 50 : 0,
        ...(html ? { icon: { content: html, anchor: input.kind === "origin" || input.kind === "destination" ? new maps.Point(20, 12) : input.kind === "step" ? new maps.Point(14, 14) : input.kind === "via" ? new maps.Point(7, 7) : input.kind === "pick" ? new maps.Point(16, 32) : input.kind === "bus" ? new maps.Point(14, 14) : new maps.Point(12, 12) } } : {}),
      });
      const listener = onSelect ? maps.Event.addListener(marker, "click", () => onSelect(input.id)) : null;
      return { marker, listener, input };
    });
    markersRef.current = markers;
    declutter();
    return () => {
      markersRef.current = [];
      for (const { marker, listener } of markers) {
        if (listener) maps.Event.removeListener(listener);
        marker.setMap(null);
      }
    };
  }, [maps, items, selectedId, onSelect]);

  // 작은 점 이름 겹침 정리(TASK-038) — 지도를 움직이거나 확대할 때마다
  function declutter() {
    const map = mapRef.current;
    if (!maps || !map || typeof map.getProjection !== "function") return;
    const projection = map.getProjection();
    const offsetOf = (m: MarkerInput) => projection.fromCoordToOffset(new maps.LatLng(m.position.lat, m.position.lng));
    // 지도 아래쪽 NAVER 로고·저작권 표시·축척 줄에는 이름을 두지 않는다(Maps 약관 — 표시를 가리지 않음)
    const center = projection.fromCoordToOffset(map.getCenter());
    const size = map.getSize();
    const attribution = { x: center.x - size.width / 2, y: center.y + size.height / 2 - ATTRIBUTION_STRIP_PX, w: size.width, h: ATTRIBUTION_STRIP_PX };
    // 🚌·단계 번호 라벨은 늘 보이므로 먼저 자리를 잡는다
    const fixed = markersRef.current
      .filter(({ input }) => input.kind === "bus" || input.kind === "step")
      .map(({ input }) => {
        const p = offsetOf(input);
        return labelBoxFor(p.x + 8, p.y, input.title);
      });
    const vias = markersRef.current.filter(({ input }) => input.kind === "via");
    const show = pickVisibleLabels(
      vias.map(({ input }) => {
        const p = offsetOf(input);
        return labelBoxFor(p.x, p.y, input.title);
      }),
      [attribution, ...fixed],
    );
    vias.forEach(({ marker }, i) => marker.getElement?.()?.classList.toggle("show-via-label", show[i]));
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    const listener = maps.Event.addListener(map, "idle", declutter);
    return () => maps.Event.removeListener(listener);
    // declutter는 ref만 읽는다
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || !fitBounds) return;
    const { sw, ne } = fitBounds;
    if (sw.lat === ne.lat && sw.lng === ne.lng) {
      map.setCenter(new maps.LatLng(sw.lat, sw.lng));
      map.setZoom(16);
    } else {
      map.fitBounds(new maps.LatLngBounds(new maps.LatLng(sw.lat, sw.lng), new maps.LatLng(ne.lat, ne.lng)), {
        ...fitPadding,
      });
    }
  }, [maps, fitBounds, fitPadding]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || !focus || typeof map.getProjection !== "function") return;
    // 확대 수준은 바꾸지 않는다. 지점이 여백 안쪽에 보이면 그대로, 아니면 여백 안쪽 가운데로 옮긴다
    // (panToBounds는 크기 0인 범위를 최대로 확대해 쓰지 않는다 — TASK-027)
    const point = new maps.LatLng(focus.lat, focus.lng);
    const projection = map.getProjection();
    const size = map.getSize();
    const p = projection.fromCoordToOffset(point);
    const c = projection.fromCoordToOffset(map.getCenter());
    const pad = fitPadding;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const visible =
      dx >= -size.width / 2 + pad.left && dx <= size.width / 2 - pad.right && dy >= -size.height / 2 + pad.top && dy <= size.height / 2 - pad.bottom;
    if (visible) return;
    const target = projection.fromOffsetToCoord(new maps.Point(p.x - (pad.left - pad.right) / 2, p.y - (pad.top - pad.bottom) / 2));
    map.panTo(target);
    // 선택이 바뀔 때만 옮긴다(여백 변경만으로는 옮기지 않음)
  }, [maps, focus?.lat, focus?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || stopPaths.length === 0 || typeof maps.Polyline !== "function") return;
    const lines = stopPaths.map(
      (path) => new maps.Polyline({ map, path: path.map((c) => new maps.LatLng(c.lat, c.lng)), ...STOP_PATH_STYLE }),
    );
    return () => lines.forEach((line) => line.setMap(null));
  }, [maps, stopPaths]);

  // 확대 수준에 따라 정류장 이름 표시/숨김(지도 영역 class만 바꾼다)
  useEffect(() => {
    const map = mapRef.current;
    const el = container.current;
    if (!maps || !map || !el || typeof map.getZoom !== "function") return;
    const update = () => {
      el.classList.toggle("hide-marker-labels", map.getZoom() < LABEL_MIN_ZOOM);
    };
    update();
    const listener = maps.Event.addListener(map, "zoom_changed", update);
    return () => maps.Event.removeListener(listener);
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || !onMapClick) return;
    const listener = maps.Event.addListener(map, "click", (e: naver.maps.PointerEvent) =>
      onMapClick({ lat: e.coord.y, lng: e.coord.x }),
    );
    return () => maps.Event.removeListener(listener);
  }, [maps, onMapClick]);

  return <div id="map" ref={container} role="region" aria-label={ariaLabel} />;
}
