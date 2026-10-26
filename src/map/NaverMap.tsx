// NAVER 지도 컴포넌트 (TASK-010, FR-004·FR-020 기반)
// SDK 로드 상태는 부모가 관리하고, 이 컴포넌트는 준비된 SDK로 지도와 마커만 그린다.

import { useEffect, useRef } from "react";
import type { Coordinates } from "../../shared/domain";
import { markerHtml, toMarkerInputs, type MapItem } from "./markers";

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
  ariaLabel: string;
}

export function NaverMap({ maps, center, zoom, items, selectedId = null, onSelect, onMapClick, fitBounds = null, ariaLabel }: NaverMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);

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
        zIndex: selected ? 100 : input.kind === "step" ? 60 : input.kind === "origin" || input.kind === "destination" ? 50 : 0,
        ...(html ? { icon: { content: html, anchor: input.kind === "origin" || input.kind === "destination" ? new maps.Point(20, 12) : input.kind === "step" ? new maps.Point(14, 14) : new maps.Point(12, 12) } } : {}),
      });
      const listener = onSelect ? maps.Event.addListener(marker, "click", () => onSelect(input.id)) : null;
      return { marker, listener };
    });
    return () => {
      for (const { marker, listener } of markers) {
        if (listener) maps.Event.removeListener(listener);
        marker.setMap(null);
      }
    };
  }, [maps, items, selectedId, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || !fitBounds) return;
    const { sw, ne } = fitBounds;
    if (sw.lat === ne.lat && sw.lng === ne.lng) {
      map.setCenter(new maps.LatLng(sw.lat, sw.lng));
      map.setZoom(16);
    } else {
      map.fitBounds(new maps.LatLngBounds(new maps.LatLng(sw.lat, sw.lng), new maps.LatLng(ne.lat, ne.lng)), {
        top: 40, right: 40, bottom: 40, left: 40,
      });
    }
  }, [maps, fitBounds]);

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
