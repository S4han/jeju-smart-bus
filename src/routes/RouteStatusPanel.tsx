// 노선 운행 현황 화면(TASK-037, D-35) — 노선 번호를 넣으면 세부 노선(방면)별 운행 중 차량 수와 차량별 다음 정류장
import { useId } from "react";
import type { Route, RouteId, Stop, StopId } from "../../shared/domain";
import { useTicker } from "../arrivals/useArrivals";
import { routeNumber, routeVariant, stopNameWithDirection } from "../route/display";
import { ROUTE_STATUS_MAX_VARIANTS } from "./routeStatus";
import type { RouteStatus } from "./useRouteStatus";

interface RouteStatusPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  matches: ReadonlyArray<Route>;
  statuses: ReadonlyMap<RouteId, RouteStatus>;
  stopsById: ReadonlyMap<StopId, Stop>;
  selectedRouteId: RouteId | null;
  onSelectRoute: (id: RouteId | null) => void;
  onRefresh: () => void;
  available: boolean;
}

export function RouteStatusPanel(props: RouteStatusPanelProps) {
  const { query, onQueryChange, matches, statuses, stopsById, selectedRouteId, onSelectRoute, onRefresh, available } = props;
  const inputId = useId();
  const now = useTicker(10_000, statuses.size > 0);
  const stopName = (id: StopId) => {
    const s = stopsById.get(id);
    return s ? stopNameWithDirection(s) : `정류장 번호 ${id}`;
  };
  const received = [...statuses.values()].flatMap((s) => (s.status === "ok" ? [s.receivedAtMs] : []));
  const ageSec = received.length ? Math.max(0, Math.round((now - Math.min(...received)) / 1000)) : null;

  return (
    <section className="card route-status" aria-labelledby="route-status-title">
      <h2 id="route-status-title">노선 운행 현황</h2>
      <label htmlFor={inputId} className="visually-hidden">
        노선 번호
      </label>
      {!available ? (
        <p>노선 데이터를 불러오는 중이거나 불러오지 못했습니다.</p>
      ) : (
        <input
          id={inputId}
          type="search"
          inputMode="numeric"
          value={query}
          placeholder="노선 번호 (예: 254)"
          autoComplete="off"
          onChange={(e) => onQueryChange(e.target.value)}
        />
      )}
      {query.trim() !== "" && matches.length === 0 && <p className="route-note">일치하는 노선이 없습니다.</p>}
      {matches.length > 0 && (
        <>
          <div className="route-status-head">
            <p className="route-note">
              방면별 실시간 운행 차량(제주 버스정보시스템 실시간 예측){ageSec !== null && ` · ${ageSec}초 전 기준`}
            </p>
            <button type="button" className="link-button is-strong" onClick={onRefresh}>
              새로고침
            </button>
          </div>
          <ul className="route-status-list">
            {matches.map((r, i) => {
              const st = statuses.get(r.id);
              const selected = r.id === selectedRouteId;
              const towards = r.stopIds.length ? stopName(r.stopIds[r.stopIds.length - 1]) : "방면 확인 불가";
              const variant = routeVariant(r);
              return (
                <li key={r.id} className={selected ? "is-selected" : undefined}>
                  <button type="button" aria-pressed={selected} onClick={() => onSelectRoute(selected ? null : r.id)}>
                    <span className="bus-pill">{routeNumber(r, r.id)}</span>
                    <span className="row-main">
                      <span className="nearby-name">{towards} 방면</span>
                      <span className="nearby-meta">
                        {variant ?? r.name}
                        {" · "}
                        {i >= ROUTE_STATUS_MAX_VARIANTS
                          ? "조회 수 제한으로 운행 현황을 불러오지 않음"
                          : !st || st.status === "loading"
                            ? "불러오는 중…"
                            : st.status === "failed"
                              ? "운행 현황을 불러오지 못했습니다"
                              : st.vehicles.length > 0
                                ? `운행 중 ${st.vehicles.length}대`
                                : "지금 운행 중인 차량 없음"}
                      </span>
                    </span>
                    <span className="row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                  {selected && st?.status === "ok" && st.vehicles.length > 0 && (
                    <ol className="route-status-vehicles">
                      {st.vehicles.map((v) => (
                        <li key={v.vehicleId}>
                          🚌 {stopName(v.nextStopId)}에 {v.minutes === 0 ? "곧" : `${v.minutes}분 후`} 도착 예정
                          <small> ({v.nextStopOrder}번째 정류장)</small>
                        </li>
                      ))}
                    </ol>
                  )}
                  {selected && (
                    <details className="route-via route-status-stops">
                      <summary>정류장 {r.stopIds.length}곳 보기</summary>
                      <ol>
                        {r.stopIds.map((id, k) => {
                          const coming = st?.status === "ok" ? st.vehicles.filter((v) => v.nextStopOrder === k + 1) : [];
                          return (
                            <li key={`${id}-${k}`} className={coming.length ? "has-bus" : undefined}>
                              {stopName(id)}
                              {coming.map((v) => (
                                <span key={v.vehicleId} className="route-status-coming">
                                  {" "}
                                  🚌 {v.minutes === 0 ? "곧 도착" : `${v.minutes}분 후 도착`}
                                </span>
                              ))}
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="route-note">지도의 🚌 표시는 차량의 실제 위치가 아니라 다음에 도착할 정류장입니다.</p>
        </>
      )}
    </section>
  );
}
