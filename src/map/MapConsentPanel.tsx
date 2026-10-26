// 지도 이용 고지·동의 화면 (TASK-021, D-27)
// 문구의 법적 충분성은 D-12(사용자 검토) 대상이다.

import type { MapConsent } from "./consent";

interface MapConsentPanelProps {
  state: Exclude<MapConsent, "granted">;
  onGrant: () => void;
  onDecline: () => void;
}

export function MapConsentPanel({ state, onGrant, onDecline }: MapConsentPanelProps) {
  if (state === "declined") {
    return (
      <section className="map-consent" aria-labelledby="map-consent-title">
        <h2 id="map-consent-title">지도를 사용하지 않음</h2>
        <p>지도 이용에 동의하지 않아 지도를 표시하지 않습니다. 정류장 목록과 정류장 이름 검색은 이용할 수 있습니다.</p>
        <button type="button" onClick={onGrant}>
          동의하고 지도 보기
        </button>
      </section>
    );
  }
  return (
    <section className="map-consent" aria-labelledby="map-consent-title">
      <h2 id="map-consent-title">지도 이용 안내</h2>
      <p>지도는 네이버 클라우드 플랫폼 지도 서비스(NAVER Maps)를 사용합니다.</p>
      <p>
        지도를 표시하는 동안 지도 영역과 서비스 이용 정보가 네이버클라우드㈜와 네이버㈜에 제공되어 보관·활용될 수
        있습니다.
      </p>
      <p>동의하지 않아도 정류장 목록과 정류장 이름 검색은 이용할 수 있습니다.</p>
      <div className="map-consent-actions">
        <button type="button" onClick={onGrant}>
          동의하고 지도 보기
        </button>
        <button type="button" onClick={onDecline}>
          지도 없이 이용
        </button>
      </div>
    </section>
  );
}
