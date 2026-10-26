// 정류장 도착정보 (TASK-014, FR-005·FR-014, AC-005·AC-014)
// 실시간(120초 이내 산출, 차량 있음)만 시간을 보여 준다. 그 밖에는 "실시간 정보 없음" — 추정치를 만들지 않는다(시간표 자료 없음, R-21)
import { useMemo } from "react";
import { buildArrivalBoard, currentAgeSeconds } from "../../shared/arrivals";
import type { Route, RouteId, Stop } from "../../shared/domain";
import type { ArrivalsState } from "./useArrivals";
import { useTicker } from "./useArrivals";

interface ArrivalPanelProps {
  stop: Stop;
  state: ArrivalsState;
  routesById: ReadonlyMap<RouteId, Route>;
  onRefresh: () => void;
}

const FAILURE_MESSAGES: Record<string, string> = {
  invalid_input: "이 정류장의 도착정보를 요청할 수 없습니다.",
  inconsistent: "도착정보 응답이 이 정류장과 맞지 않아 표시하지 않습니다.",
};

export function ArrivalPanel({ stop, state, routesById, onRefresh }: ArrivalPanelProps) {
  const now = useTicker(10_000, state.status === "ready");
  const board = useMemo(() => {
    if (state.status !== "ready") return null;
    const { payload, cacheAgeSeconds, receivedAtMs } = state.snapshot;
    return buildArrivalBoard(stop.id, payload.arrivals, routesById, (a) =>
      currentAgeSeconds(a.ageSecondsAtFetch, cacheAgeSeconds, now - receivedAtMs),
    );
  }, [state, stop.id, routesById, now]);

  return (
    <section className="arrivals" aria-labelledby="arrivals-title">
      <h2 id="arrivals-title">{stop.name} 도착정보</h2>
      <div aria-live="polite">
        {state.status === "loading" && <p>도착정보를 불러오는 중입니다…</p>}
        {state.status !== "loading" && state.status !== "ready" && state.status !== "idle" && (
          <p>{FAILURE_MESSAGES[state.status] ?? "도착정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p>
        )}
        {board && (
          <>
            {board.realtime.length > 0 ? (
              <ul className="arrivals-list">
                {board.realtime.map(({ route, arrival }) => (
                  <li key={`${route.id}-${arrival.stopOrder}-${arrival.vehicleId}`}>
                    <span className="arrivals-route">
                      {route.name}
                      {route.subName && <span className="arrivals-sub"> ({route.subName})</span>}
                    </span>
                    <span className="arrivals-time">
                      <strong>{arrival.minutesToArrival}분 후</strong>
                      {arrival.stopsAway !== null && ` · ${arrival.stopsAway}정류장 전`}
                      <span className="arrivals-badge">실시간</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>지금 이 정류장에 실시간 도착정보가 없습니다.</p>
            )}
            {board.routesWithoutRealtime > 0 && board.realtime.length > 0 && (
              <p className="arrivals-note">그 밖의 노선 {board.routesWithoutRealtime}개는 실시간 도착정보가 없습니다.</p>
            )}
            <p className="arrivals-note">시간표 자료가 없어 추정 도착시간은 제공하지 않습니다.</p>
          </>
        )}
      </div>
      {state.status !== "idle" && state.status !== "loading" && (
        <button type="button" className="link-button" onClick={onRefresh}>
          도착정보 새로고침
        </button>
      )}
    </section>
  );
}
