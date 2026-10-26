import { useCallback, useMemo, useState } from "react";
import { SNAPSHOT_PATH } from "../shared/sources";
import type { Coordinates } from "../shared/domain";
import { createHttpSnapshotSource } from "./data/httpSnapshotSource";
import { DataAttribution } from "./data/DataAttribution";
import { MapConsentPanel } from "./map/MapConsentPanel";
import { NaverMap } from "./map/NaverMap";
import { STATUS_MESSAGES } from "./map/naverSdk";
import { useMapConsent } from "./map/useMapConsent";
import { useNaverMaps } from "./map/useNaverMaps";
import { OriginPanel } from "./origin/OriginPanel";
import { originFromMapPoint, type Origin } from "./origin/origin";
import { useCurrentLocation } from "./origin/useCurrentLocation";
import { useStopNames } from "./origin/useStopNames";

// 지도는 이용 동의 후에만 불러온다(TASK-021, D-27). 동의 후 지도 동작·문구는 PoC와 같다(TASK-010)
const JEJU = { lat: 33.4996, lng: 126.5312 };
const POC_ITEMS = [{ id: "jeju-city", title: "제주시", coordinates: JEJU }];

// 정류장·노선 정적 스냅샷(D-01, D-10 (A) 승인) — 빌드 때 생성된 공개 데이터 파일
const SNAPSHOT_SOURCE = createHttpSnapshotSource(`${import.meta.env.BASE_URL}${SNAPSHOT_PATH}`);

export default function App() {
  const consent = useMapConsent();
  const granted = consent.state === "granted";
  const { status, maps } = useNaverMaps(import.meta.env.VITE_NAVER_MAP_CLIENT_ID, granted);

  // 출발지 좌표는 이 메모리 상태로만 둔다 — URL·저장소·서버로 보내지 않는다(TASK-011, PRIV-001~003)
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [picking, setPicking] = useState(false);
  const location = useCurrentLocation();
  const stopList = useStopNames(SNAPSHOT_SOURCE);
  const mapPickAvailable = granted && status === "ready";

  const handleMapClick = useCallback((coordinates: Coordinates) => {
    setOrigin(originFromMapPoint(coordinates));
    setPicking(false);
  }, []);

  const items = useMemo(
    () => (origin ? [...POC_ITEMS, { id: "origin", title: "출발지", coordinates: origin.coordinates }] : POC_ITEMS),
    [origin],
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
            selectedId={origin ? "origin" : null}
            onMapClick={picking ? handleMapClick : undefined}
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
        picking={picking && mapPickAvailable}
        onPickingChange={setPicking}
      />
      <DataAttribution generatedAt={stopList.status === "ready" ? stopList.generatedAt : null} />
    </main>
  );
}
