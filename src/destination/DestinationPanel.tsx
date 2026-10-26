// 목적지 설정 (TASK-015, FR-006, AC-006, D-05) — 정류장명 검색 또는 지도 직접 지정. 외부 장소 검색 없음
import type { Origin } from "../origin/origin";
import { describeOrigin } from "../origin/origin";
import { PlacePicker } from "../origin/PlacePicker";
import type { StopListState } from "../origin/useStopNames";

interface DestinationPanelProps {
  destination: Origin | null;
  onChange: (destination: Origin | null) => void;
  stopList: StopListState;
  mapPickAvailable: boolean;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
}

export function DestinationPanel({ destination, onChange, stopList, mapPickAvailable, picking, onPickingChange }: DestinationPanelProps) {
  return (
    <section className="origin" aria-labelledby="destination-title">
      <h2 id="destination-title">목적지</h2>
      <p aria-live="polite" className="origin-current">
        {destination ? `목적지: ${describeOrigin(destination)}` : "목적지를 아직 정하지 않았습니다."}
      </p>
      <PlacePicker
        label="목적지"
        stopList={stopList}
        onSelect={onChange}
        mapPickAvailable={mapPickAvailable}
        picking={picking}
        onPickingChange={onPickingChange}
      >
        {destination && (
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            목적지 지우기
          </button>
        )}
      </PlacePicker>
    </section>
  );
}
