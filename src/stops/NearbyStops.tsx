// 주변 정류장 목록 (TASK-012, FR-003, AC-003). 지도 동기화는 TASK-013
import { useEffect, useState } from "react";
import type { Coordinates, Stop } from "../../shared/domain";
import {
  EXPANDED_RADIUS_METERS,
  NEARBY_RADIUS_METERS,
  declineExpansion,
  expandNearby,
  formatDistance,
  searchNearby,
  type NearbyState,
} from "./nearby";

interface NearbyStopsProps {
  stops: ReadonlyArray<Stop>;
  origin: Coordinates;
}

export function NearbyStops({ stops, origin }: NearbyStopsProps) {
  const [state, setState] = useState<NearbyState>(() => searchNearby(stops, origin));
  // 출발지가 바뀌면 500m부터 다시 찾는다(이전 확대 동의는 이어지지 않음)
  useEffect(() => setState(searchNearby(stops, origin)), [stops, origin]);

  return (
    <section className="nearby" aria-labelledby="nearby-title">
      <h2 id="nearby-title">주변 정류장</h2>
      <div aria-live="polite">
        {state.phase === "results" && (
          <>
            <p>
              출발지에서 반경 {formatDistance(state.radiusMeters)} 안의 정류장 {state.stops.length}곳 (직선거리 기준)
            </p>
            <ol className="nearby-list">
              {state.stops.map(({ stop, distanceMeters }) => (
                <li key={stop.id}>
                  <span className="nearby-name">{stop.name}</span>
                  <span className="nearby-meta">
                    {formatDistance(distanceMeters)} · 정류장 번호 {stop.id}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        {(state.phase === "offer_expansion" || state.phase === "expansion_declined") && (
          <>
            <p>
              반경 {formatDistance(NEARBY_RADIUS_METERS)} 안에 정류장이 없습니다.
              {state.phase === "offer_expansion"
                ? ` ${formatDistance(EXPANDED_RADIUS_METERS)}까지 넓혀 찾을까요?`
                : " 넓혀 찾지 않았습니다."}
            </p>
            <div className="nearby-actions">
              <button type="button" onClick={() => setState((s) => expandNearby(s, stops, origin))}>
                {formatDistance(EXPANDED_RADIUS_METERS)}까지 찾기
              </button>
              {state.phase === "offer_expansion" && (
                <button type="button" onClick={() => setState(declineExpansion)}>
                  넓히지 않기
                </button>
              )}
            </div>
          </>
        )}
        {state.phase === "none_within_expanded" && (
          <p>반경 {formatDistance(EXPANDED_RADIUS_METERS)} 안에도 정류장이 없습니다. 출발지를 바꿔 다시 찾아 주세요.</p>
        )}
      </div>
    </section>
  );
}
