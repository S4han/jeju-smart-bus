// 주변 정류장 목록 (TASK-012 FR-003·AC-003, TASK-013 FR-004·AC-004)
// 결과 상태는 부모가 지도와 함께 쓰고, 이 컴포넌트는 같은 상태를 목록으로 그린다.
import { useEffect, useId, useRef, useState } from "react";
import { stopNameWithDirection } from "../route/display";
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

// 처음에는 가까운 몇 곳만, 나머지는 "더 보기"(TASK-028). 지도에는 전체가 그대로 표시된다(AC-004 — 같은 집합)
export const NEARBY_PREVIEW_COUNT = 5;

export function NearbyStops({ state, onExpand, onDecline, selectedId = null, onSelect, placeLabel = "출발지" }: NearbyStopsProps) {
  const titleId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const [showAll, setShowAll] = useState(false);
  const all = state.phase === "results" ? state.stops : [];
  const selectedIndex = all.findIndex((n) => n.stop.id === selectedId);
  // 지도에서 목록 밖(접힌 부분) 정류장을 고르면 목록을 펼친다
  const expanded = showAll || selectedIndex >= NEARBY_PREVIEW_COUNT;
  const visible = expanded ? all : all.slice(0, NEARBY_PREVIEW_COUNT);
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
              {placeLabel}에서 반경 {formatDistance(state.radiusMeters)} 안의 정류장{" "}
              {state.stops.filter((n) => !n.pairOfId).length}곳 (직선거리 기준)
              {state.stops.some((n) => n.pairOfId) &&
                ` · 반경 밖이지만 같은 이름 정류장 바로 옆(길 건너 반대 방향 등) ${state.stops.filter((n) => n.pairOfId).length}곳 함께 표시`}
            </p>
            <ol className="nearby-list" ref={listRef}>
              {visible.map(({ stop, distanceMeters, pairOfId }) => {
                const selected = stop.id === selectedId;
                const main = (
                  <span className="row-main">
                    <span className="nearby-name">{stopNameWithDirection(stop)}</span>
                    <span className="nearby-meta">
                      정류장 번호 {stop.id}
                      {pairOfId && " · 반경 밖(같은 이름 정류장 옆)"}
                      {selected && " · 선택됨"}
                    </span>
                  </span>
                );
                const distance = <span className="row-side">{formatDistance(distanceMeters)}</span>;
                if (!onSelect) {
                  return (
                    <li key={stop.id} className="nearby-static">
                      {main}
                      {distance}
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
                      {main}
                      {distance}
                      <span className="row-chevron" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {all.length > NEARBY_PREVIEW_COUNT && (
              <button type="button" className="btn btn-secondary btn-block nearby-more" aria-expanded={expanded} onClick={() => setShowAll(!expanded)}>
                {expanded ? "접기" : `${all.length - NEARBY_PREVIEW_COUNT}곳 더 보기`}
              </button>
            )}
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
