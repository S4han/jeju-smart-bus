// 정류장 도착정보 (TASK-014, FR-005·FR-014, AC-005·AC-014)
// 실시간(120초 이내 산출, 차량 있음)만 시간을 보여 준다. 그 밖에는 "실시간 정보 없음" — 추정치를 만들지 않는다(시간표 자료 없음, R-21)
import { useMemo, type ReactNode } from "react";
import { buildArrivalBoard, currentAgeSeconds } from "../../shared/arrivals";
import type { Route, RouteId, Stop } from "../../shared/domain";
import type { ArrivalsState } from "./useArrivals";
import { routeNumber, routeVariant, stopNameWithDirection } from "../route/display";
import { useTicker } from "./useArrivals";

interface ArrivalPanelProps {
  stop: Stop;
  state: ArrivalsState;
  routesById: ReadonlyMap<RouteId, Route>;
  onRefresh: () => void;
  // 정류장 제목 아래 동작(출발지로·도착지로 — TASK-027)
  actions?: ReactNode;
}

// 장애 원인별 안내(TASK-019). 실패 시에는 이전 값·추정치를 보여 주지 않는다(AC-017)
const FAILURE_MESSAGES: Record<string, string> = {
  invalid_input: "이 정류장의 도착정보를 요청할 수 없습니다.",
  inconsistent: "도착정보 응답이 이 정류장과 맞지 않아 표시하지 않습니다.",
  rate_limited: "도착정보 요청이 많아 잠시 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  quota_exhausted: "도착정보 서비스 이용 한도에 도달해 도착정보 조회를 잠시 중단했습니다.",
  unavailable: "도착정보 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export function ArrivalPanel({ stop, state, routesById, onRefresh, actions }: ArrivalPanelProps) {
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
      <h2 id="arrivals-title">{stopNameWithDirection(stop)} 도착정보</h2>
      {actions}
      <div aria-live="polite">
        {state.status === "loading" && <p>도착정보를 불러오는 중입니다…</p>}
        {state.status !== "loading" && state.status !== "ready" && state.status !== "idle" && (
          <>
            <p>{FAILURE_MESSAGES[state.status] ?? "도착정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p>
            <p className="arrivals-note">정류장 검색·주변 정류장·경로 찾기는 계속 이용할 수 있습니다.</p>
          </>
        )}
        {board && (
          <>
            {board.realtime.length > 0 ? (
              <ul className="arrivals-list">
                {board.realtime.map(({ route, arrival }) => (
                  <li key={`${route.id}-${arrival.stopOrder}-${arrival.vehicleId}`}>
                    <span className="arrivals-route">
                      {routeNumber(route, route.id)}
                      <span className="arrivals-sub">
                        {" "}
                        ({[routeVariant(route), route.subName].filter(Boolean).join(" · ")})
                      </span>
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
