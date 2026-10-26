// 경로 찾기 실행 상태 (TASK-016). 탐색은 브라우저 안에서만 한다(D-01) — 좌표·정류장을 서버로 보내지 않는다
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route, Stop } from "../../shared/domain";
import type { RouteReadiness } from "./candidates";
import { findJourneys, indexRoutes, type SearchResult } from "./engine";

export function useRouteSearch(stops: ReadonlyArray<Stop> | null, routes: ReadonlyArray<Route> | null, readiness: RouteReadiness) {
  const index = useMemo(() => (stops && routes ? indexRoutes(routes, new Set(stops.map((s) => s.id))) : null), [stops, routes]);
  const [result, setResult] = useState<SearchResult | null>(null);
  // 출발지·목적지·후보가 바뀌면 이전 결과를 지운다
  useEffect(() => setResult(null), [readiness]);

  const search = useCallback(() => {
    if (!index || !readiness.ready) return;
    const toCandidates = (list: typeof readiness.origin) => list.map((n) => ({ stopId: n.stop.id, walkMeters: n.distanceMeters }));
    setResult(findJourneys(index, toCandidates(readiness.origin), toCandidates(readiness.destination)));
  }, [index, readiness]);

  return { result, search, canSearch: index !== null && readiness.ready };
}
