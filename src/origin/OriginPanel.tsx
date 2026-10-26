// 출발지 설정 화면 (TASK-011, FR-001·FR-002, AC-001·AC-002, D-05)
// 위치 안내 문구는 PRIV-001-004.md §7 초안이며 법적 충분성은 D-12(사용자 검토) 대상이다.

import { useEffect, useState } from "react";
import type { Origin } from "./origin";
import { describeOrigin, originFromCurrentLocation } from "./origin";
import { PlacePicker } from "./PlacePicker";
import { LOCATION_MESSAGES } from "./geolocation";
import type { LocationState } from "./useCurrentLocation";
import type { StopListState } from "./useStopNames";

interface OriginPanelProps {
  origin: Origin | null;
  onChange: (origin: Origin | null) => void;
  location: LocationState;
  onRequestLocation: () => void;
  stopList: StopListState;
  // 지도 이용 동의(D-27) 후 지도가 준비된 경우에만 지도 지정 가능
  mapPickAvailable: boolean;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
}

export function OriginPanel(props: OriginPanelProps) {
  const { origin, onChange, location, onRequestLocation, stopList, mapPickAvailable, picking, onPickingChange } = props;
  const [manual, setManual] = useState(false);
  const failed = location.status !== "idle" && location.status !== "requesting" && location.status !== "ok";

  // AC-001: 좌표를 확보한 경우에만 현재 위치를 출발지로 둔다
  useEffect(() => {
    if (location.status === "ok") onChange(originFromCurrentLocation(location.coordinates));
  }, [location, onChange]);

  return (
    <section className="origin" aria-labelledby="origin-title">
      <h2 id="origin-title">출발지</h2>
      <p aria-live="polite" className="origin-current">
        {origin ? `출발지: ${describeOrigin(origin)}` : "출발지를 아직 정하지 않았습니다."}
      </p>

      {location.status === "idle" && !manual && (
        <div className="origin-notice">
          <h3>현재 위치 사용 안내</h3>
          <p>주변 버스 정류장과 경로를 찾기 위해 기기의 현재 위치를 사용합니다.</p>
          <p>위치는 이 화면에서 계산에만 쓰이며 저희 서버로 전송하거나 저장하지 않습니다.</p>
          <p>지도를 표시할 때 지도 제공업체(NAVER)에 지도 영역 정보가 전달됩니다.</p>
          <p>위치 사용을 원하지 않으면 출발지를 직접 선택할 수 있습니다.</p>
          <div className="origin-actions">
            <button type="button" onClick={onRequestLocation}>
              위치 사용
            </button>
            <button type="button" onClick={() => setManual(true)}>
              직접 선택
            </button>
          </div>
        </div>
      )}

      {location.status === "requesting" && <p aria-live="polite">현재 위치를 확인하는 중입니다…</p>}

      {failed && (
        <div role="status" className="origin-failure">
          <p>{LOCATION_MESSAGES[location.status]}</p>
          <button type="button" className="link-button" onClick={onRequestLocation}>
            현재 위치 다시 시도
          </button>
        </div>
      )}

      {(manual || failed || location.status === "ok") && (
        <PlacePicker
          label="출발지"
          stopList={stopList}
          onSelect={onChange}
          mapPickAvailable={mapPickAvailable}
          picking={picking}
          onPickingChange={onPickingChange}
        >
          {manual && location.status === "idle" && (
            <button type="button" className="link-button" onClick={onRequestLocation}>
              현재 위치 사용
            </button>
          )}
        </PlacePicker>
      )}
    </section>
  );
}
