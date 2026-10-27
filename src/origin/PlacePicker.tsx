// 장소 직접 선택: 정류장명 검색 + 지도 직접 지정 (D-05) — 출발지(TASK-011)·목적지(TASK-015) 공용
// 목록에서 고른 정류장·지도에서 누른 지점만 장소가 된다. 입력만 한 글자는 장소가 아니다(AC-002·AC-006).

import { useId, useMemo, useState, type ReactNode } from "react";
import type { Coordinates } from "../../shared/domain";
import { haversineMeters } from "../../shared/geo";
import { formatDistance } from "../stops/nearby";
import type { Origin } from "./origin";
import { originFromStop } from "./origin";
import { nextStopNames, searchStops } from "./stopSearch";
import type { StopListState } from "./useStopNames";

interface PlacePickerProps {
  label: "출발지" | "목적지";
  stopList: StopListState;
  onSelect: (place: Origin | null) => void;
  // 지도 이용 동의(D-27) 후 지도가 준비된 경우에만 지도 지정 가능
  mapPickAvailable: boolean;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
  // 결과에 거리를 보여 줄 기준 위치(메모리 상태만, 출발지 검색은 현재 위치·목적지 검색은 출발지) — TASK-028
  distanceFrom?: Coordinates | null;
  children?: ReactNode;
}

const formatPlaceDistance = (m: number) => (m < 1000 ? formatDistance(m) : `${(m / 1000).toFixed(1)}km`);

export function PlacePicker({ label, stopList, onSelect, mapPickAvailable, picking, onPickingChange, distanceFrom = null, children }: PlacePickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(() => (stopList.status === "ready" ? searchStops(stopList.stops, query) : []), [stopList, query]);
  // 같은 이름 정류장이 여러 곳이면 다음 정류장 이름으로 방향을 구분(TASK-028)
  const nextNames = useMemo(
    () => (stopList.status === "ready" ? nextStopNames(stopList.routes, new Map(stopList.stops.map((st) => [st.id, st] as const))) : null),
    [stopList],
  );
  const duplicated = useMemo(() => {
    const count = new Map<string, number>();
    for (const { stop } of results) count.set(stop.name, (count.get(stop.name) ?? 0) + 1);
    return count;
  }, [results]);

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
          <input
            id={inputId}
            type="search"
            value={query}
            placeholder="예: 제주시청, 공항"
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
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
                    <span className="row-main">
                      <span className="nearby-name">{stop.name}</span>
                      <span className="origin-stop-id">
                        정류장 번호 {stop.id}
                        {(duplicated.get(stop.name) ?? 0) > 1 && nextNames?.get(stop.id) && ` · 다음 정류장: ${nextNames.get(stop.id)!.slice(0, 2).join("·")}`}
                        {!selectable && " · 위치 확인 불가, 선택할 수 없음"}
                      </span>
                    </span>
                    {selectable && distanceFrom && stop.coordinates && (
                      <span className="row-side">{formatPlaceDistance(haversineMeters(distanceFrom, stop.coordinates))}</span>
                    )}
                    {selectable && (
                      <span className="row-chevron" aria-hidden="true">
                        ›
                      </span>
                    )}
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
