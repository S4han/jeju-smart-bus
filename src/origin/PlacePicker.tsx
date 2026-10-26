// 장소 직접 선택: 정류장명 검색 + 지도 직접 지정 (D-05) — 출발지(TASK-011)·목적지(TASK-015) 공용
// 목록에서 고른 정류장·지도에서 누른 지점만 장소가 된다. 입력만 한 글자는 장소가 아니다(AC-002·AC-006).

import { useId, useMemo, useState, type ReactNode } from "react";
import type { Origin } from "./origin";
import { originFromStop } from "./origin";
import { searchStops } from "./stopSearch";
import type { StopListState } from "./useStopNames";

interface PlacePickerProps {
  label: "출발지" | "목적지";
  stopList: StopListState;
  onSelect: (place: Origin | null) => void;
  // 지도 이용 동의(D-27) 후 지도가 준비된 경우에만 지도 지정 가능
  mapPickAvailable: boolean;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
  children?: ReactNode;
}

export function PlacePicker({ label, stopList, onSelect, mapPickAvailable, picking, onPickingChange, children }: PlacePickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(() => (stopList.status === "ready" ? searchStops(stopList.stops, query) : []), [stopList, query]);

  return (
    <div className="origin-manual">
      <h3>{label} 직접 선택</h3>
      <label htmlFor={inputId}>정류장 이름 검색</label>
      {stopList.status === "unavailable" ? (
        <p>정류장 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
      ) : stopList.status === "loading" ? (
        <p>정류장 데이터를 불러오는 중입니다…</p>
      ) : (
        <>
          <input id={inputId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          <p className="origin-hint">목록에서 정류장을 골라야 {label}로 정해집니다.</p>
          {query.trim() !== "" && results.length === 0 && <p>일치하는 정류장이 없습니다.</p>}
          {results.length > 0 && (
            <ul className="origin-results">
              {results.map(({ stop, selectable }) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => {
                      onSelect(originFromStop(stop));
                      onPickingChange(false);
                    }}
                  >
                    {stop.name} <span className="origin-stop-id">({stop.id})</span>
                    {!selectable && <span> — 위치 확인 불가, 선택할 수 없음</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h3>지도에서 직접 지정</h3>
      {mapPickAvailable ? (
        <button type="button" aria-pressed={picking} onClick={() => onPickingChange(!picking)}>
          {picking ? "지도에서 고르기 취소" : `지도를 눌러 ${label} 고르기`}
        </button>
      ) : (
        <p>지도 이용에 동의하고 지도가 표시되면 지도에서 {label}를 고를 수 있습니다.</p>
      )}
      {picking && <p aria-live="polite">지도에서 {label}로 쓸 지점을 누르세요.</p>}

      {children}
    </div>
  );
}
