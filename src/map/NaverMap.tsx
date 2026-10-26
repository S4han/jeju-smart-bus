// NAVER 지도 컴포넌트 (TASK-010, FR-004·FR-020 기반)
// SDK 로드 상태는 부모가 관리하고, 이 컴포넌트는 준비된 SDK로 지도와 마커만 그린다.

import { useEffect, useRef } from "react";
import type { Coordinates } from "../../shared/domain";
import { toMarkerInputs, type MapItem } from "./markers";

interface NaverMapProps {
  maps: typeof naver.maps | null;
  center: Coordinates;
  zoom: number;
  items: ReadonlyArray<MapItem>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  ariaLabel: string;
}

export function NaverMap({ maps, center, zoom, items, selectedId = null, onSelect, ariaLabel }: NaverMapProps) {
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
      const marker = new maps.Marker({
        position: new maps.LatLng(input.position.lat, input.position.lng),
        map,
        title: input.title,
        zIndex: input.id === selectedId ? 100 : 0,
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

  return <div id="map" ref={container} role="region" aria-label={ariaLabel} />;
}
