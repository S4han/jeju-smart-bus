// 주변 정류장 목록 (TASK-012 FR-003·AC-003, TASK-013 FR-004·AC-004)
// 결과 상태는 부모가 지도와 함께 쓰고, 이 컴포넌트는 같은 상태를 목록으로 그린다.
import { useEffect, useId, useRef } from "react";
import { EXPANDED_RADIUS_METERS, NEARBY_RADIUS_METERS, formatDistance, type NearbyState } from "./nearby";

interface NearbyStopsProps {
  state: NearbyState;
  onExpand: () => void;
  onDecline: () => void;
  // 출발지 목록만 선택(지도·도착정보 연동). 목적지 후보(TASK-015)는 선택 없이 표시
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  placeLabel?: "출발지" | "목적지";
}

export function NearbyStops({ state, onExpand, onDecline, selectedId = null, onSelect, placeLabel = "출발지" }: NearbyStopsProps) {
  const titleId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  // 지도에서 고른 정류장이 목록에서도 보이도록 스크롤
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-stop-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <section className="nearby" aria-labelledby={titleId}>
      <h2 id={titleId}>{placeLabel === "출발지" ? "주변 정류장" : "목적지 주변 정류장"}</h2>
      <div aria-live="polite">
        {state.phase === "results" && (
          <>
            <p>
              {placeLabel}에서 반경 {formatDistance(state.radiusMeters)} 안의 정류장 {state.stops.length}곳 (직선거리 기준)
            </p>
            <ol className="nearby-list" ref={listRef}>
              {state.stops.map(({ stop, distanceMeters }) => {
                const selected = stop.id === selectedId;
                const meta = (
                  <span className="nearby-meta">
                    {formatDistance(distanceMeters)} · 정류장 번호 {stop.id}
                    {selected && " · 선택됨"}
                  </span>
                );
                if (!onSelect) {
                  return (
                    <li key={stop.id} className="nearby-static">
                      <span className="nearby-name">{stop.name}</span>
                      {meta}
                    </li>
                  );
                }
                return (
                  <li key={stop.id}>
                    <button
                      type="button"
                      data-stop-id={stop.id}
                      aria-pressed={selected}
                      className={selected ? "is-selected" : undefined}
                      onClick={() => onSelect(stop.id)}
                    >
                      <span className="nearby-name">{stop.name}</span>
                      {meta}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        {(state.phase === "offer_expansion" || state.phase === "expansion_declined") && (
          <>
            <p>
              {placeLabel} 반경 {formatDistance(NEARBY_RADIUS_METERS)} 안에 정류장이 없습니다.
              {state.phase === "offer_expansion"
                ? ` ${formatDistance(EXPANDED_RADIUS_METERS)}까지 넓혀 찾을까요?`
                : " 넓혀 찾지 않았습니다."}
            </p>
            <div className="nearby-actions">
              <button type="button" onClick={onExpand}>
                {formatDistance(EXPANDED_RADIUS_METERS)}까지 찾기
              </button>
              {state.phase === "offer_expansion" && (
                <button type="button" onClick={onDecline}>
                  넓히지 않기
                </button>
              )}
            </div>
          </>
        )}
        {state.phase === "none_within_expanded" && (
          <p>
            {placeLabel} 반경 {formatDistance(EXPANDED_RADIUS_METERS)} 안에도 정류장이 없습니다. {placeLabel}를 바꿔 다시 찾아 주세요.
          </p>
        )}
      </div>
    </section>
  );
}
