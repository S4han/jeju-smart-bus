import { MapConsentPanel } from "./map/MapConsentPanel";
import { NaverMap } from "./map/NaverMap";
import { STATUS_MESSAGES } from "./map/naverSdk";
import { useMapConsent } from "./map/useMapConsent";
import { useNaverMaps } from "./map/useNaverMaps";

// PoC 화면 — 지도는 이용 동의 후에만 불러온다(TASK-021, D-27). 동의 후 동작·문구는 PoC와 같다(TASK-010)
const JEJU = { lat: 33.4996, lng: 126.5312 };
const POC_ITEMS = [{ id: "jeju-city", title: "제주시", coordinates: JEJU }];

export default function App() {
  const consent = useMapConsent();
  const granted = consent.state === "granted";
  const { status, maps } = useNaverMaps(import.meta.env.VITE_NAVER_MAP_CLIENT_ID, granted);
  return (
    <main>
      <h1>제주 스마트 버스</h1>
      <p>네이버 Dynamic Map 연결 테스트</p>
      {consent.state === "granted" ? (
        <>
          <NaverMap maps={maps} center={JEJU} zoom={11} items={POC_ITEMS} ariaLabel="제주 지도" />
          <p aria-live="polite">{STATUS_MESSAGES[status]}</p>
          <button type="button" className="link-button" onClick={consent.revoke}>
            지도 이용 동의 철회
          </button>
        </>
      ) : (
        <MapConsentPanel state={consent.state} onGrant={consent.grant} onDecline={consent.decline} />
      )}
    </main>
  );
}
