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
import { describeOrigin, originFromMapPoint, originFromStop, type Origin } from "./origin/origin";
import { useCurrentLocation } from "./origin/useCurrentLocation";
import { useStopNames } from "./origin/useStopNames";
import { NearbyStops } from "./stops/NearbyStops";
import { boundsOf, journeyMapItems, nearbyMapItems, nearbyStopsOf, pickPreviewItems } from "./stops/mapItems";
import { findStopsWithin, formatDistance, NEARBY_RADIUS_METERS } from "./stops/nearby";
import { stepPoints, viaStops } from "./route/steps";
import { useNearbyStops } from "./stops/useNearbyStops";
import { DestinationPanel } from "./destination/DestinationPanel";
import { ENDPOINT_LABEL, routeReadiness, type EndpointKey } from "./route/candidates";
import { RouteReadinessNotice } from "./route/RouteReadinessNotice";
import { useRouteSearch, walkFromCurrentLocation } from "./route/useRouteSearch";
import { useJourneyTimes } from "./route/useJourneyTimes";
import { impactNotice, type Cause, type Service } from "./service/impact";
import { ServiceNotices } from "./service/ServiceNotices";
import { BottomSheet, type SheetSnap } from "./ui/BottomSheet";
import { useMapLayout } from "./ui/layout";

// 지도는 이용 동의 후에만 불러온다(TASK-021, D-27). 지도 동작·상태 문구는 PoC와 같다(TASK-010). 화면 구성은 TASK-022
const JEJU = { lat: 33.4996, lng: 126.5312 };
const POC_ITEMS = [{ id: "jeju-city", title: "제주시", coordinates: JEJU }];

// 지도 위에 떠 있는 출발·도착 카드를 피해 지도 범위를 맞춘다(TASK-022). 왼쪽 패널 배치는 카드가 패널 안에 있다(TASK-023)
const SHEET_MAP_PADDING = { top: 150, right: 40, bottom: 40, left: 40 };
const SIDE_MAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

// 지도에서 고를 때 핀 주변에 미리 보여 줄 정류장 반경(사용자 요청 2026-10-27)
const PICK_PREVIEW_RADIUS_METERS = 1_000;

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
  // 출발지·목적지 선택 화면 열림 여부 — 정하면 접고 "변경"으로 연다(TASK-028)
  const [editing, setEditing] = useState<Record<EndpointKey, boolean>>({ origin: false, destination: false });
  const chooseOrigin = useCallback((place: Origin | null) => {
    setOrigin(place);
    if (place) setEditing((e) => ({ ...e, origin: false }));
  }, []);
  const chooseDestination = useCallback((place: Origin | null) => {
    setDestination(place);
    if (place) setEditing((e) => ({ ...e, destination: false }));
  }, []);
  // 지도 직접 지정 대상(출발지·목적지 중 하나만)
  const [pickTarget, setPickTarget] = useState<EndpointKey | null>(null);
  const location = useCurrentLocation();
  const stopList = useStopNames(SNAPSHOT_SOURCE);
  const mapPickAvailable = granted && status === "ready";

  // 지도에서 고르기(TASK-034): 누른 지점에 핀을 옮기고 반경 1km 정류장을 미리 보여 준 뒤, "이 위치로 정하기"나 정류장을 눌러 확정
  const [pickPreview, setPickPreview] = useState<Coordinates | null>(null);
  useEffect(() => setPickPreview(null), [pickTarget]);
  const handleMapClick = useCallback((coordinates: Coordinates) => setPickPreview(coordinates), []);
  const commitPick = useCallback(
    (place: Origin | null) => {
      if (!place) return;
      if (pickTarget === "origin") chooseOrigin(place);
      if (pickTarget === "destination") chooseDestination(place);
      setPickTarget(null);
    },
    [pickTarget, chooseOrigin, chooseDestination],
  );

  // 지도와 목록은 같은 결과 상태를 쓴다(TASK-013, AC-004)
  const stops = stopList.status === "ready" ? stopList.stops : null;
  const stopsById = useMemo(() => new Map((stops ?? []).map((s) => [s.id, s] as const)), [stops]);
  const nearby = useNearbyStops(stops, origin?.coordinates ?? null);
  // 목적지 후보 정류장 — 출발지와 따로 찾고 확대 동의도 따로 받는다(TASK-015, AC-007)
  const destinationNearby = useNearbyStops(stops, destination?.coordinates ?? null);
  const readiness = useMemo(
    () => routeReadiness({ origin: nearby.state, destination: destinationNearby.state }),
    [nearby.state, destinationNearby.state],
  );
  // 정류장을 출발지로 골랐고 현재 위치를 알면, 출발 쪽 걷는 거리는 현재 위치에서 승차 정류장까지(TASK-033)
  // 단, 현재 위치가 고른 정류장에서 2km를 넘으면(다른 곳에서 미리 찾는 경우) 정류장 기준(사용자 지정 2026-10-27, 설정값)
  const walkFrom = walkFromCurrentLocation(origin, location.state.status === "ok" ? location.state.coordinates : null);
  const routeSearch = useRouteSearch(stops, stopList.status === "ready" ? stopList.routes : null, readiness, walkFrom);
  // 상세를 연 경로 — 지도에 승차·환승·하차 단계 번호를 표시(TASK-018, D-16)
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  useEffect(() => setSelectedJourneyId(null), [routeSearch.result]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  useEffect(() => setSelectedStopId(null), [nearby.state]);

  // 출발지·목적지 전에는 PoC 화면 그대로(제주시 마커), 정해지면 출발지·목적지·출발지 주변 정류장만
  const hasPlace = origin !== null || destination !== null;
  const selectedJourney = useMemo(
    () => (routeSearch.result?.status === "ok" ? routeSearch.result.journeys.find((j) => j.id === selectedJourneyId) : undefined),
    [routeSearch.result, selectedJourneyId],
  );
  const selectedPoints = useMemo(() => (selectedJourney ? stepPoints(selectedJourney, stopsById) : null), [selectedJourney, stopsById]);
  // 경유 정류장(TASK-029): 노선 정차 순서대로, 지도에 작은 점으로
  const selectedVia = useMemo(
    () => (selectedJourney && stopList.status === "ready" ? viaStops(selectedJourney, stopsById, new Map(stopList.routes.map((r) => [r.id, r] as const))) : []),
    [selectedJourney, stopsById, stopList],
  );
  // 핀 주변 반경 1km 정류장(미리보기 — 경로 후보 규칙 AC-003·AC-007은 확정 후 그대로 적용)
  const pickStops = useMemo(() => (stops && pickPreview ? findStopsWithin(stops, pickPreview, PICK_PREVIEW_RADIUS_METERS) : []), [stops, pickPreview]);
  const items = useMemo(() => {
    if (pickTarget && pickPreview) return pickPreviewItems(pickPreview, pickStops, NEARBY_RADIUS_METERS);
    if (!hasPlace) return POC_ITEMS;
    const o = origin?.coordinates ?? null;
    const d = destination?.coordinates ?? null;
    return selectedPoints ? journeyMapItems(selectedPoints, o, d, selectedVia) : nearbyMapItems(nearby.state, o, d);
  }, [pickTarget, pickPreview, pickStops, hasPlace, selectedPoints, selectedVia, nearby.state, origin, destination]);
  const fitBounds = useMemo(
    () =>
      pickTarget && pickPreview
        ? boundsOf([pickPreview, ...pickStops.map((n) => n.stop.coordinates)])
        : hasPlace
        ? boundsOf([
            ...(origin ? [origin.coordinates] : []),
            ...(destination ? [destination.coordinates] : []),
            ...(selectedPoints
              ? [...selectedPoints.map((p) => p.stop), ...selectedVia].flatMap((p) => (p.coordinates ? [p.coordinates] : []))
              : nearbyStopsOf(nearby.state).map((n) => n.stop.coordinates)),
          ])
        : null,
    [pickTarget, pickPreview, pickStops, hasPlace, origin, destination, nearby.state, selectedPoints, selectedVia],
  );
  const selectedStop = useMemo(
    () => nearbyStopsOf(nearby.state).find((n) => n.stop.id === selectedStopId)?.stop ?? null,
    [nearby.state, selectedStopId],
  );
  const routesById = useMemo(
    () => new Map(stopList.status === "ready" ? stopList.routes.map((r) => [r.id, r] as const) : []),
    [stopList],
  );
  // 결과 상위 경로의 노선 실시간 예측으로 총 소요시간 계산(TASK-017, GATE-05, D-30)
  const journeyTimes = useJourneyTimes(ARRIVAL_SOURCE, routeSearch.result, routesById);
  const arrivals = useArrivals(ARRIVAL_SOURCE, selectedStop?.id ?? null);

  const handleMarkerSelect = useCallback(
    (id: string) => {
      // 고르는 중에는 미리 보인 정류장을 누르면 그 정류장으로 바로 정한다
      const picked = pickTarget ? pickStops.find((n) => n.stop.id === id) : undefined;
      if (picked) commitPick(originFromStop(picked.stop));
      else if (nearbyStopsOf(nearby.state).some((n) => n.stop.id === id)) setSelectedStopId(id);
    },
    [nearby.state, pickTarget, pickStops, commitPick],
  );

  // 서비스 장애 영향 안내(TASK-019). 지도는 동의한 경우에만 대상, 도착정보 장애는 도착정보 영역에서도 안내
  const notices = useMemo(() => {
    const down: Array<[Service, Cause]> = [];
    if (granted && (status === "init_failed" || status === "load_failed" || status === "missing_client_id")) down.push(["naver_maps", "unavailable"]);
    if (stopList.status === "unavailable") down.push(["snapshot", "unavailable"]);
    const arrivalCause = arrivals.state.status;
    if (arrivalCause === "unavailable" || arrivalCause === "rate_limited" || arrivalCause === "quota_exhausted" || arrivalCause === "inconsistent")
      down.push(["bus_arrivals", arrivalCause]);
    const services = down.map(([svc]) => svc);
    return down.map(([svc, cause]) => impactNotice(svc, cause, services));
  }, [granted, status, stopList.status, arrivals.state.status]);

  const describe = (place: Origin | null) => (place ? describeOrigin(place) : null);

  // 지도 전체 화면 + 아래 패널(TASK-022). 지도를 보여 줘야 할 때(경로 상세, 지도에서 지정)는 패널을 접는다
  const [sheet, setSheet] = useState<SheetSnap>("peek");
  // 기기 화면에 맞춘 배치: 세로 휴대폰은 아래 패널, 태블릿·PC·가로 휴대폰은 왼쪽 패널(TASK-023)
  const layout = useMapLayout();
  useEffect(() => {
    if (pickTarget) setSheet("peek");
  }, [pickTarget]);

  // 요약 카드에서 출발·도착을 누르면 패널을 펴고 해당 선택 화면을 연다
  const openEditor = (key: EndpointKey) => {
    setSheet("full");
    setEditing((e) => ({ ...e, [key]: true }));
  };
  const swapPlaces = () => {
    setOrigin(destination);
    setDestination(origin);
  };
  // 경로 찾기 결과가 나오면 패널을 펴고 결과로 이동(TASK-028)
  useEffect(() => {
    if (!routeSearch.result) return;
    // 결과가 나오면 지도(경로 번호·경유 정류장)와 요약이 함께 보이도록 접힌 높이로
    setSheet("peek");
    requestAnimationFrame(() => document.getElementById("route-results")?.scrollIntoView?.({ block: "start" }));
  }, [routeSearch.result]);

  const trip = (floating: boolean) => (
    <nav className={floating ? "trip is-floating" : "trip"} aria-label="출발지·목적지 요약">
      <div className="trip-rows">
      <a className="trip-row" href="#origin-title" onClick={() => openEditor("origin")}>
        <span className="trip-dot" aria-hidden="true" />
        <span className="trip-label">출발</span>
        <span className={describe(origin) ? "trip-value" : "trip-value is-empty"}>{describe(origin) ?? "출발지를 정해 주세요"}</span>
        <span className="trip-chevron" aria-hidden="true">›</span>
      </a>
      <a className="trip-row is-destination" href="#destination-title" onClick={() => openEditor("destination")}>
        <span className="trip-dot" aria-hidden="true" />
        <span className="trip-label">도착</span>
        <span className={describe(destination) ? "trip-value" : "trip-value is-empty"}>{describe(destination) ?? "목적지를 정해 주세요"}</span>
        <span className="trip-chevron" aria-hidden="true">›</span>
      </a>
      </div>
      {(origin || destination) && (
        <button type="button" className="trip-swap" aria-label="출발지와 목적지 바꾸기" onClick={swapPlaces}>
          <span aria-hidden="true">⇅</span>
        </button>
      )}
    </nav>
  );

  // 지도·목록에서 고른 정류장: 맨 위에 도착정보와 함께 "출발지로·도착지로" 버튼(TASK-027)
  const isOriginStop = (id: string) => origin?.kind === "stop" && origin.stopId === id;
  const isDestinationStop = (id: string) => destination?.kind === "stop" && destination.stopId === id;
  const selectedStopPanel = selectedStop && (
    <ArrivalPanel
      stop={selectedStop}
      state={arrivals.state}
      routesById={routesById}
      onRefresh={arrivals.refresh}
      actions={
        <div className="stop-actions">
          <button
            type="button"
            className="btn btn-block btn-weak"
            disabled={isOriginStop(selectedStop.id)}
            onClick={() => chooseOrigin(originFromStop(selectedStop))}
          >
            {isOriginStop(selectedStop.id) ? "출발지로 정함" : "출발지로"}
          </button>
          <button
            type="button"
            className="btn btn-block btn-destination"
            disabled={isDestinationStop(selectedStop.id)}
            onClick={() => chooseDestination(originFromStop(selectedStop))}
          >
            {isDestinationStop(selectedStop.id) ? "도착지로 정함" : "도착지로"}
          </button>
        </div>
      }
    />
  );
  // 정류장을 고르면 패널을 그 카드 위치로 스크롤
  useEffect(() => {
    if (selectedStopId) document.getElementById("arrivals-title")?.closest("section")?.scrollIntoView?.({ block: "start" });
  }, [selectedStopId]);

  const panels = (
    <>
      {selectedStopPanel}
      <OriginPanel
        origin={origin}
        onChange={chooseOrigin}
        editing={editing.origin}
        onEditingChange={(on) => setEditing((e) => ({ ...e, origin: on }))}
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
      <DestinationPanel
        destination={destination}
        onChange={chooseDestination}
        editing={editing.destination}
        onEditingChange={(on) => setEditing((e) => ({ ...e, destination: on }))}
        distanceFrom={origin?.coordinates ?? null}
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
        routesById={routesById}
        stopsById={stopsById}
        selectedJourneyId={selectedJourneyId}
        onSelectJourney={setSelectedJourneyId}
        estimator={journeyTimes.estimator}
        timing={journeyTimes.state}
        originLabel={walkFrom ? "현재 위치" : origin ? describeOrigin(origin) : "출발지"}
        destinationLabel={destination ? describeOrigin(destination) : "목적지"}
      />
      <DataAttribution generatedAt={stopList.status === "ready" ? stopList.generatedAt : null} />
    </>
  );

  const hero = (
    <section className="hero" aria-label="출발지와 목적지">
      <p className="hero-title">어디로 갈까요?</p>
      <p className="hero-sub">주변 정류장, 실시간 도착, 환승 2회까지 버스 경로를 찾아요.</p>
    </section>
  );

  // 지도 미동의: 지도 없이 카드 화면(D-27)
  if (consent.state !== "granted") {
    return (
      <div className="app">
        <header className="topbar">
          <h1>제주 스마트 버스</h1>
        </header>
        <main className="page">
          <ServiceNotices notices={notices} />
          {hero}
          {trip(false)}
          <MapConsentPanel state={consent.state} onGrant={consent.grant} onDecline={consent.decline} />
          {panels}
        </main>
      </div>
    );
  }

  const mapView = (
    <NaverMap
      maps={maps}
      center={JEJU}
      zoom={11}
      items={items}
      selectedId={selectedStopId}
      onSelect={handleMarkerSelect}
      fitBounds={fitBounds}
      fitPadding={layout === "side" ? SIDE_MAP_PADDING : SHEET_MAP_PADDING}
      focus={selectedStop?.coordinates ?? null}
      onMapClick={pickTarget ? handleMapClick : undefined}
      ariaLabel="제주 지도"
    />
  );
  // 지도에서 고르기 안내(TASK-034) — 지도 위쪽(NAVER 로고가 있는 아래쪽과 겹치지 않음)
  const pickNear = pickStops.filter((n) => n.distanceMeters <= NEARBY_RADIUS_METERS).length;
  const pickBanner = pickTarget && (
    <div className="pick-banner" role="status" aria-live="polite">
      {pickPreview ? (
        <>
          <p className="pick-banner-title">이 지점을 {ENDPOINT_LABEL[pickTarget]}로 할까요?</p>
          <p className="pick-banner-text">
            {pickStops.length > 0
              ? `반경 1km 정류장 ${pickStops.length}곳(500m 안 ${pickNear}곳, 가장 가까운 곳 ${formatDistance(pickStops[0].distanceMeters)}). 정류장을 누르면 그 정류장으로 정해요.`
              : "반경 1km 안에 정류장이 없어 이 지점으로는 버스 경로를 찾을 수 없어요. 다른 곳을 눌러 주세요."}
          </p>
          <div className="pick-banner-actions">
            <button type="button" className="btn" disabled={pickStops.length === 0} onClick={() => commitPick(originFromMapPoint(pickPreview))}>
              이 위치로 정하기
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPickTarget(null)}>
              취소
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="pick-banner-title">지도를 눌러 {ENDPOINT_LABEL[pickTarget]}를 고르세요</p>
          <div className="pick-banner-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setPickTarget(null)}>
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
  const mapCaption = (
    <div className="map-caption">
      <p aria-live="polite">{STATUS_MESSAGES[status]}</p>
      <button type="button" className="link-button" onClick={consent.revoke}>
        지도 이용 동의 철회
      </button>
    </div>
  );

  // 태블릿·PC: 왼쪽 패널 + 오른쪽 지도. 패널과 지도는 겹치지 않아 NAVER 로고가 가려지지 않는다
  if (layout === "side") {
    return (
      <div className="map-screen is-side">
        <aside className="side-panel" aria-label="버스 정보 패널">
          <header className="side-header">
            <h1>제주 스마트 버스</h1>
          </header>
          <div className="side-body">
            <ServiceNotices notices={notices} />
            {trip(false)}
            {panels}
            {mapCaption}
          </div>
        </aside>
        <section className="map-stage" aria-label="지도">
          {mapView}
          {pickBanner}
        </section>
      </div>
    );
  }

  // 세로 휴대폰: 지도는 접힌 패널 위에서 끝나 NAVER 로고가 항상 보인다. 펼친 패널은 화면 전체를 덮어 지도를 일부만 보이지 않게 한다
  return (
    <div className={`map-screen is-${sheet}`}>
      <h1 className="visually-hidden">제주 스마트 버스</h1>
      <section className="map-stage" aria-label="지도">
        {mapView}
        {/* 지도에서 고르는 동안에는 요약 카드 자리에 안내를 띄운다(지도와 패널 사이 공간이 좁음) */}
        {sheet !== "full" && !pickTarget && trip(true)}
        {pickBanner}
      </section>
      <BottomSheet snap={sheet} onSnapChange={setSheet} label="버스 정보 패널">
        <ServiceNotices notices={notices} />
        {/* 펼치면 지도 위 요약 카드가 가려지므로 패널 안에 같은 요약을 둔다 */}
        {sheet === "full" && trip(false)}
        {panels}
        {mapCaption}
      </BottomSheet>
    </div>
  );
}
