import { NaverMap } from "./map/NaverMap";
import { STATUS_MESSAGES } from "./map/naverSdk";
import { useNaverMaps } from "./map/useNaverMaps";

// PoC 화면 — 지도 모듈 분리 후에도 동작·문구를 그대로 유지한다(TASK-010, D-18)
const JEJU = { lat: 33.4996, lng: 126.5312 };
const POC_ITEMS = [{ id: "jeju-city", title: "제주시", coordinates: JEJU }];

export default function App() {
  const { status, maps } = useNaverMaps(import.meta.env.VITE_NAVER_MAP_CLIENT_ID);
  return (
    <main>
      <h1>제주 스마트 버스</h1>
      <p>네이버 Dynamic Map 연결 테스트</p>
      <NaverMap maps={maps} center={JEJU} zoom={11} items={POC_ITEMS} ariaLabel="제주 지도" />
      <p aria-live="polite">{STATUS_MESSAGES[status]}</p>
    </main>
  );
}
