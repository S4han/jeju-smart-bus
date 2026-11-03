// 노선 운행 현황 불러오기(TASK-037). 받은 시각(receivedAtMs)은 performance.now 기준이다 — 노선 ID와 그 노선의 첫 정류장 ID만 서버로 보낸다(D-30과 같은 요청, 좌표 없음)
import { useCallback, useEffect, useState } from "react";
import { currentAgeSeconds, type TimedArrival } from "../../shared/arrivals";
import type { Result, Route, RouteId, StopId } from "../../shared/domain";
import type { ArrivalsSnapshot } from "../data/httpArrivalSource";
import { buildRoutePredictions } from "../route/timing";
import { ROUTE_STATUS_MAX_VARIANTS, runningVehicles, type RunningVehicle } from "./routeStatus";

interface RoutePredictionSource {
  getRoutePredictions(routeId: RouteId, stopId: StopId): Promise<Result<ArrivalsSnapshot>>;
}

export type RouteStatus = { status: "loading" } | { status: "ok"; vehicles: RunningVehicle[]; receivedAtMs: number } | { status: "failed" };

export function useRouteStatus(source: RoutePredictionSource, routes: ReadonlyArray<Route>) {
  const [statuses, setStatuses] = useState<Map<RouteId, RouteStatus>>(new Map());
  const [tick, setTick] = useState(0);
  const key = routes.map((r) => r.id).join(",");

  useEffect(() => {
    const targets = routes.slice(0, ROUTE_STATUS_MAX_VARIANTS);
    if (targets.length === 0) {
      setStatuses(new Map());
      return;
    }
    let active = true;
    setStatuses(new Map(targets.map((r) => [r.id, { status: "loading" } as RouteStatus])));
    for (const route of targets) {
      source.getRoutePredictions(route.id, route.stopIds[0]).then(
        (r) => {
          if (!active) return;
          let next: RouteStatus = { status: "failed" };
          if (r.status === "ok") {
            const snap = r.data;
            const ageOf = (row: TimedArrival) => currentAgeSeconds(row.ageSecondsAtFetch, snap.cacheAgeSeconds, performance.now() - snap.receivedAtMs);
            next = { status: "ok", vehicles: runningVehicles(route, buildRoutePredictions(route, snap.payload.arrivals, ageOf)), receivedAtMs: snap.receivedAtMs };
          }
          setStatuses((m) => new Map(m).set(route.id, next));
        },
        () => active && setStatuses((m) => new Map(m).set(route.id, { status: "failed" })),
      );
    }
    return () => {
      active = false;
    };
    // routes 내용은 key로 비교
  }, [source, key, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { statuses, refresh };
}
