// 노선 운행 현황(TASK-037, D-35): 노선 번호로 노선을 찾고, 노선 단위 실시간 예측(D-30)에서 운행 중 차량을 뽑는다.
// 차량 위치는 만들지 않는다 — 각 차량이 "다음에 도착할 정류장"과 남은 분만 쓴다(NFR-004). 좌표는 그 정류장 좌표
import type { Route, StopId } from "../../shared/domain";
import { routeNumber } from "../route/display";
import type { RoutePredictions } from "../route/timing";

// 한 번에 운행 현황을 불러오는 세부 노선 수 상한(호출량 제한, 미확정 설정값)
export const ROUTE_STATUS_MAX_VARIANTS = 12;

export function normalizeRouteQuery(q: string): string {
  return q.normalize("NFC").replace(/\s+/g, "").replace(/번$/, "").toLowerCase();
}

// "254" → 표시 번호가 254인 노선(254-1·254-2…), "254-1" → 그 노선. 결과는 노선 이름 순(숫자 인식)
export function matchRoutes(routes: ReadonlyArray<Route>, query: string): Route[] {
  const q = normalizeRouteQuery(query);
  if (!q) return [];
  return routes
    .filter((r) => {
      const name = r.name.toLowerCase();
      return name === q || routeNumber(r, r.id).toLowerCase() === q;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
}

export interface RunningVehicle {
  vehicleId: string;
  // 이 차량이 다음에 도착할 정류장(노선 순번·ID)과 남은 분
  nextStopOrder: number;
  nextStopId: StopId;
  minutes: number;
}

// 정류장별 "가장 먼저 오는 차량" 예측에서 차량마다 가장 먼저 도착할 정류장을 고른다.
// 운행 중인 모든 차량은 바로 앞 정류장의 "가장 먼저 오는 차량"이므로 빠짐없이 나온다(종점 통과 차량 제외)
export function runningVehicles(route: Route, predictions: RoutePredictions): RunningVehicle[] {
  const byVehicle = new Map<string, RunningVehicle>();
  for (const [order, p] of predictions) {
    const stopId = route.stopIds[order - 1];
    if (!stopId) continue;
    const cur = byVehicle.get(p.vehicleId);
    if (!cur || p.minutes < cur.minutes || (p.minutes === cur.minutes && order < cur.nextStopOrder))
      byVehicle.set(p.vehicleId, { vehicleId: p.vehicleId, nextStopOrder: order, nextStopId: stopId, minutes: p.minutes });
  }
  return [...byVehicle.values()].sort((a, b) => a.nextStopOrder - b.nextStopOrder);
}
