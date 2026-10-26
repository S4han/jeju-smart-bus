import { useCallback, useEffect, useMemo, useState } from "react";
import { SNAPSHOT_PATH } from "../shared/sources";
import type { Coordinates } from "../shared/domain";
import { createHttpSnapshotSource } from "./data/httpSnapshotSource";
import { DataAttribution } from "./data/DataAttribution";
import { createHttpArrivalSource } from "./data/httpArrivalSource";
import { ArrivalPanel } from "./arrivals/ArrivalPanel";
import { useArrivals } from "./arrivals/useArrivals";
import { MapConsentPanel } from "./map/MapConsentPanel";
import { NaverMap } from "./map/NaverMap";
import { STATUS_MESSAGES } from "./map/naverSdk";
import { useMapConsent } from "./map/useMapConsent";
import { useNaverMaps } from "./map/useNaverMaps";
import { OriginPanel } from "./origin/OriginPanel";
import { originFromMapPoint, type Origin } from "./origin/origin";
import { useCurrentLocation } from "./origin/useCurrentLocation";
import { useStopNames } from "./origin/useStopNames";
import { NearbyStops } from "./stops/NearbyStops";
import { boundsOf, nearbyMapItems, nearbyStopsOf } from "./stops/mapItems";
import { useNearbyStops } from "./stops/useNearbyStops";
import { DestinationPanel } from "./destination/DestinationPanel";
import { routeReadiness, type EndpointKey } from "./route/candidates";
import { RouteReadinessNotice } from "./route/RouteReadinessNotice";
import { useRouteSearch } from "./route/useRouteSearch";

// 지도는 이용 동의 후에만 불러온다(TASK-021, D-27). 동의 후 지도 동작·문구는 PoC와 같다(TASK-010)
const JEJU = { lat: 33.4996, lng: 126.5312 };
const POC_ITEMS = [{ id: "jeju-city", title: "제주시", coordinates: JEJU }];

// 정류장·노선 정적 스냅샷(D-01, D-10 (A) 승인) — 빌드 때 생성된 공개 데이터 파일
const SNAPSHOT_SOURCE = createHttpSnapshotSource(`${import.meta.env.BASE_URL}${SNAPSHOT_PATH}`);

// 도착정보는 정류장 ID만 서버로 보낸다(TASK-014, D-22)
const ARRIVAL_SOURCE = createHttpArrivalSource();

export default function App() {
  const consent = useMapConsent();
  const granted = consent.state === "granted";
  const { status, maps } = useNaverMaps(import.meta.env.VITE_NAVER_MAP_CLIENT_ID, granted);

  // 출발지 좌표는 이 메모리 상태로만 둔다 — URL·저장소·서버로 보내지 않는다(TASK-011, PRIV-001~003)
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [destination, setDestination] = useState<Origin | null>(null);
  // 지도 직접 지정 대상(출발지·목적지 중 하나만)
  const [pickTarget, setPickTarget] = useState<EndpointKey | null>(null);
  const location = useCurrentLocation();
  const stopList = useStopNames(SNAPSHOT_SOURCE);
  const mapPickAvailable = granted && status === "ready";

  const handleMapClick = useCallback(
    (coordinates: Coordinates) => {
      if (pickTarget === "origin") setOrigin(originFromMapPoint(coordinates));
      if (pickTarget === "destination") setDestination(originFromMapPoint(coordinates));
      setPickTarget(null);
    },
    [pickTarget],
  );

  // 지도와 목록은 같은 결과 상태를 쓴다(TASK-013, AC-004)
  const stops = stopList.status === "ready" ? stopList.stops : null;
  const nearby = useNearbyStops(stops, origin?.coordinates ?? null);
  // 목적지 후보 정류장 — 출발지와 따로 찾고 확대 동의도 따로 받는다(TASK-015, AC-007)
  const destinationNearby = useNearbyStops(stops, destination?.coordinates ?? null);
  const readiness = useMemo(
    () => routeReadiness({ origin: nearby.state, destination: destinationNearby.state }),
    [nearby.state, destinationNearby.state],
  );
  const routeSearch = useRouteSearch(stops, stopList.status === "ready" ? stopList.routes : null, readiness);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  useEffect(() => setSelectedStopId(null), [nearby.state]);

  // 출발지·목적지 전에는 PoC 화면 그대로(제주시 마커), 정해지면 출발지·목적지·출발지 주변 정류장만
  const hasPlace = origin !== null || destination !== null;
  const items = useMemo(
    () => (hasPlace ? nearbyMapItems(nearby.state, origin?.coordinates ?? null, destination?.coordinates ?? null) : POC_ITEMS),
    [hasPlace, nearby.state, origin, destination],
  );
  const fitBounds = useMemo(
    () =>
      hasPlace
        ? boundsOf([
            ...(origin ? [origin.coordinates] : []),
            ...(destination ? [destination.coordinates] : []),
            ...nearbyStopsOf(nearby.state).map((n) => n.stop.coordinates),
          ])
        : null,
    [hasPlace, origin, destination, nearby.state],
  );
  const selectedStop = useMemo(
    () => nearbyStopsOf(nearby.state).find((n) => n.stop.id === selectedStopId)?.stop ?? null,
    [nearby.state, selectedStopId],
  );
  const routesById = useMemo(
    () => new Map(stopList.status === "ready" ? stopList.routes.map((r) => [r.id, r] as const) : []),
    [stopList],
  );
  const arrivals = useArrivals(ARRIVAL_SOURCE, selectedStop?.id ?? null);

  const handleMarkerSelect = useCallback(
    (id: string) => {
      if (nearbyStopsOf(nearby.state).some((n) => n.stop.id === id)) setSelectedStopId(id);
    },
    [nearby.state],
  );

  return (
    <main>
      <h1>제주 스마트 버스</h1>
      <p>네이버 Dynamic Map 연결 테스트</p>
      {consent.state === "granted" ? (
        <>
          <NaverMap
            maps={maps}
            center={JEJU}
            zoom={11}
            items={items}
            selectedId={selectedStopId}
            onSelect={handleMarkerSelect}
            fitBounds={fitBounds}
            onMapClick={pickTarget ? handleMapClick : undefined}
            ariaLabel="제주 지도"
          />
          <p aria-live="polite">{STATUS_MESSAGES[status]}</p>
          <button type="button" className="link-button" onClick={consent.revoke}>
            지도 이용 동의 철회
          </button>
        </>
      ) : (
        <MapConsentPanel state={consent.state} onGrant={consent.grant} onDecline={consent.decline} />
      )}
      <OriginPanel
        origin={origin}
        onChange={setOrigin}
        location={location.state}
        onRequestLocation={location.request}
        stopList={stopList}
        mapPickAvailable={mapPickAvailable}
        picking={pickTarget === "origin" && mapPickAvailable}
        onPickingChange={(on) => setPickTarget(on ? "origin" : null)}
      />
      {nearby.state && (
        <NearbyStops
          state={nearby.state}
          onExpand={nearby.expand}
          onDecline={nearby.decline}
          selectedId={selectedStopId}
          onSelect={setSelectedStopId}
        />
      )}
      {selectedStop && (
        <ArrivalPanel stop={selectedStop} state={arrivals.state} routesById={routesById} onRefresh={arrivals.refresh} />
      )}
      <DestinationPanel
        destination={destination}
        onChange={setDestination}
        stopList={stopList}
        mapPickAvailable={mapPickAvailable}
        picking={pickTarget === "destination" && mapPickAvailable}
        onPickingChange={(on) => setPickTarget(on ? "destination" : null)}
      />
      {destinationNearby.state && (
        <NearbyStops
          state={destinationNearby.state}
          onExpand={destinationNearby.expand}
          onDecline={destinationNearby.decline}
          placeLabel="목적지"
        />
      )}
      <RouteReadinessNotice
        readiness={readiness}
        canSearch={routeSearch.canSearch}
        onSearch={routeSearch.search}
        result={routeSearch.result}
      />
      <DataAttribution generatedAt={stopList.status === "ready" ? stopList.generatedAt : null} />
    </main>
  );
}
