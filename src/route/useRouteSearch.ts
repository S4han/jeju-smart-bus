// 경로 찾기 실행 상태 (TASK-016). 탐색은 브라우저 안에서만 한다(D-01) — 좌표·정류장을 서버로 보내지 않는다
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Coordinates, Route, Stop } from "../../shared/domain";
import { haversineMeters } from "../../shared/geo";
import type { NearbyStop } from "../stops/nearby";
import type { RouteReadiness } from "./candidates";
import { findJourneys, indexRoutes, type SearchResult } from "./engine";

// walkFrom: 출발 쪽 걷는 거리의 기준점. 정류장을 출발지로 골랐어도 현재 위치를 알면 현재 위치에서 승차 정류장까지 직선거리(TASK-033).
// 좌표는 브라우저 메모리에서만 쓴다(PRIV-001~003)
// 정류장 출발지에서 현재 위치 기준 걷는 거리를 쓰는 최대 거리(TASK-033, 사용자 지정 2km — 설정값)
export const CURRENT_LOCATION_WALK_MAX_METERS = 2_000;

// 출발 쪽 걷는 거리 기준점: 정류장을 출발지로 골랐고 현재 위치가 그 정류장에서 2km 이내면 현재 위치, 아니면 null(장소 기준)
export function walkFromCurrentLocation(
  origin: { kind: string; coordinates: Coordinates } | null,
  current: Coordinates | null,
  maxMeters = CURRENT_LOCATION_WALK_MAX_METERS,
): Coordinates | null {
  return origin?.kind === "stop" && current && haversineMeters(current, origin.coordinates) <= maxMeters ? current : null;
}

// 승하차 후보와 걷는 거리. walkFrom이 있으면 그 지점에서의 직선거리, 없으면 장소에서의 거리(주변 정류장 결과 그대로)
export function toCandidates(list: ReadonlyArray<NearbyStop>, walkFrom: Coordinates | null) {
  return list.map((n) => ({ stopId: n.stop.id, walkMeters: walkFrom ? haversineMeters(walkFrom, n.stop.coordinates) : n.distanceMeters }));
}

export function useRouteSearch(
  stops: ReadonlyArray<Stop> | null,
  routes: ReadonlyArray<Route> | null,
  readiness: RouteReadiness,
  walkFrom: Coordinates | null = null,
) {
  const index = useMemo(() => (stops && routes ? indexRoutes(routes, new Set(stops.map((s) => s.id))) : null), [stops, routes]);
  const [result, setResult] = useState<SearchResult | null>(null);
  // 출발지·목적지·후보가 바뀌면 이전 결과를 지운다
  useEffect(() => setResult(null), [readiness, walkFrom]);

  const search = useCallback(() => {
    if (!index || !readiness.ready) return;
    setResult(findJourneys(index, toCandidates(readiness.origin, walkFrom), toCandidates(readiness.destination, null)));
  }, [index, readiness, walkFrom]);

  return { result, search, canSearch: index !== null && readiness.ready };
}
