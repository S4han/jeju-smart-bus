// 목적지 설정 (TASK-015, FR-006, AC-006, D-05) — 정류장명 검색 또는 지도 직접 지정. 외부 장소 검색 없음
import type { Coordinates } from "../../shared/domain";
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
  // 정한 뒤에는 접어 둔다(TASK-028). 검색 결과 거리 기준은 출발지
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  distanceFrom: Coordinates | null;
}

export function DestinationPanel(props: DestinationPanelProps) {
  const { destination, onChange, stopList, mapPickAvailable, picking, onPickingChange, editing, onEditingChange, distanceFrom } = props;
  if (destination && !editing) {
    return (
      <section className="origin is-compact" aria-labelledby="destination-title">
        <h2 id="destination-title">목적지</h2>
        <div className="place-summary">
          <p aria-live="polite" className="origin-current">
            {describeOrigin(destination)}
          </p>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => onEditingChange(true)}>
            변경
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="origin" aria-labelledby="destination-title">
      <h2 id="destination-title">목적지</h2>
      <p aria-live="polite" className="origin-current">
        {destination ? `지금: ${describeOrigin(destination)}` : "목적지를 아직 정하지 않았습니다."}
      </p>
      <PlacePicker
        label="목적지"
        stopList={stopList}
        onSelect={onChange}
        mapPickAvailable={mapPickAvailable}
        picking={picking}
        onPickingChange={onPickingChange}
        distanceFrom={distanceFrom}
      >
        {destination && (
          <div className="place-edit-actions">
            <button type="button" className="link-button" onClick={() => onEditingChange(false)}>
              변경 취소
            </button>
            <button type="button" className="link-button" onClick={() => onChange(null)}>
              목적지 지우기
            </button>
          </div>
        )}
      </PlacePicker>
    </section>
  );
}
