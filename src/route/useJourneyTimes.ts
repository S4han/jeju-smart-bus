// 경로별 실시간 예측 불러오기 (TASK-017 시간 부분, D-30) — 노선 ID와 그 노선의 정류장 ID만 서버로 보낸다
import { useEffect, useMemo, useState } from "react";
import { currentAgeSeconds, type TimedArrival } from "../../shared/arrivals";
import type { Result, Route, RouteId, StopId } from "../../shared/domain";
import type { ArrivalsSnapshot } from "../data/httpArrivalSource";
import { useTicker } from "../arrivals/useArrivals";
import type { Journey, SearchResult } from "./engine";
import { UNVERIFIED_TIME, type TimeEstimator } from "./ranking";
import { buildRoutePredictions, realtimeEstimator, type RoutePredictions } from "./timing";

// 한 번의 경로 찾기에서 예측을 조회하는 서로 다른 노선 수 상한(호출량 제한). 미확정 설정값
export const MAX_ROUTE_REQUESTS = 20;

interface RoutePredictionSource {
  getRoutePredictions(routeId: RouteId, stopId: StopId): Promise<Result<ArrivalsSnapshot>>;
}

// 결과 순서(환승 → 걷기 → 식별자)대로, 노선 수 상한 안에서 시간을 계산할 경로의 노선을 고른다
export function routesToRequest(journeys: ReadonlyArray<Journey>, limit = MAX_ROUTE_REQUESTS): Map<RouteId, StopId> {
  const picked = new Map<RouteId, StopId>();
  for (const j of journeys) {
    const extra = j.legs.filter((l) => !picked.has(l.routeId));
    if (picked.size + new Set(extra.map((l) => l.routeId)).size > limit) continue;
    for (const l of extra) if (!picked.has(l.routeId)) picked.set(l.routeId, l.boardStopId);
  }
  return picked;
}

export type TimingState = { status: "idle" } | { status: "loading" } | { status: "ready"; failedRoutes: number; requestedRoutes: number };

export function useJourneyTimes(source: RoutePredictionSource, result: SearchResult | null, routesById: ReadonlyMap<RouteId, Route>) {
  const [snapshots, setSnapshots] = useState<Map<RouteId, ArrivalsSnapshot>>(new Map());
  const [state, setState] = useState<TimingState>({ status: "idle" });

  useEffect(() => {
    setSnapshots(new Map());
    if (!result || result.status !== "ok") {
      setState({ status: "idle" });
      return;
    }
    let active = true;
    const requests = routesToRequest(result.journeys);
    setState({ status: "loading" });
    Promise.all([...requests].map(async ([routeId, stopId]) => [routeId, await source.getRoutePredictions(routeId, stopId)] as const)).then(
      (results) => {
        if (!active) return;
        const ok = new Map<RouteId, ArrivalsSnapshot>();
        for (const [routeId, r] of results) if (r.status === "ok") ok.set(routeId, r.data);
        setSnapshots(ok);
        setState({ status: "ready", failedRoutes: results.length - ok.size, requestedRoutes: results.length });
      },
    );
    return () => {
      active = false;
    };
  }, [source, result]);

  // 화면을 열어 둔 동안 120초 기준(D-04)을 다시 적용
  const now = useTicker(10_000, snapshots.size > 0);
  const estimator: TimeEstimator = useMemo(() => {
    if (snapshots.size === 0) return UNVERIFIED_TIME;
    const predictions = new Map<RouteId, RoutePredictions>();
    for (const [routeId, snap] of snapshots) {
      const route = routesById.get(routeId);
      if (!route) continue;
      const ageOf = (row: TimedArrival) => currentAgeSeconds(row.ageSecondsAtFetch, snap.cacheAgeSeconds, now - snap.receivedAtMs);
      predictions.set(routeId, buildRoutePredictions(route, snap.payload.arrivals, ageOf));
    }
    return realtimeEstimator(predictions);
  }, [snapshots, routesById, now]);

  return { estimator, state };
}
