import { useEffect, useRef, useState } from "react";

declare global { interface Window { naver?: any } }
const JEJU = { lat: 33.4996, lng: 126.5312 };
export default function App() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("지도 SDK 로딩 중...");
  useEffect(() => {
    const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
    if (!clientId) { setStatus("VITE_NAVER_MAP_CLIENT_ID 환경변수가 없습니다."); return; }
    const script = document.createElement("script");
    script.src = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=" + encodeURIComponent(clientId);
    script.async = true;
    script.onload = () => {
      if (!window.naver?.maps || !mapDiv.current) { setStatus("지도 SDK 초기화 실패: 인증 정보와 허용 URL을 확인하세요."); return; }
      const naver = window.naver;
      const center = new naver.maps.LatLng(JEJU.lat, JEJU.lng);
      const map = new naver.maps.Map(mapDiv.current, { center, zoom: 11 });
      new naver.maps.Marker({ position: center, map, title: "제주시" });
      setStatus("제주 지도 표시 완료 · 이동 및 확대/축소를 테스트하세요.");
    };
    script.onerror = () => setStatus("지도 SDK 로딩 실패: Client ID 및 Web 서비스 URL을 확인하세요.");
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);
  return <main><h1>제주 스마트 버스</h1><p>네이버 Dynamic Map 연결 테스트</p><div id="map" ref={mapDiv} role="region" aria-label="제주 지도"/><p aria-live="polite">{status}</p></main>;
}
