// 승차·하차 후보 정류장과 경로 탐색 시작 조건 (TASK-015, FR-006·FR-007, AC-006·AC-007)
// 출발지·목적지 각각의 주변 정류장 결과(TASK-012 흐름)를 따로 두고, 확대 동의도 위치마다 따로 받는다.
// 두 위치 모두 후보가 있을 때만 탐색할 수 있다. 후보가 없으면 경로를 만들지 않는다.

import type { NearbyState, NearbyStop } from "../stops/nearby";

export type EndpointKey = "origin" | "destination";

export type RouteReadiness =
  | { ready: true; origin: NearbyStop[]; destination: NearbyStop[] }
  | {
      ready: false;
      // 장소를 아직 고르지 않았거나 정류장 데이터가 없음
      missing: EndpointKey[];
      // 500m 0건 — 확대 동의를 기다림
      needsConsent: EndpointKey[];
      // 확대를 거절했거나 1km 안에도 없음
      noCandidates: EndpointKey[];
    };

const KEYS: EndpointKey[] = ["origin", "destination"];

export function routeReadiness(states: Record<EndpointKey, NearbyState | null>): RouteReadiness {
  const missing: EndpointKey[] = [];
  const needsConsent: EndpointKey[] = [];
  const noCandidates: EndpointKey[] = [];
  for (const key of KEYS) {
    const state = states[key];
    if (!state) missing.push(key);
    else if (state.phase === "offer_expansion") needsConsent.push(key);
    else if (state.phase === "expansion_declined" || state.phase === "none_within_expanded") noCandidates.push(key);
  }
  if (missing.length + needsConsent.length + noCandidates.length > 0) return { ready: false, missing, needsConsent, noCandidates };
  const stopsOf = (key: EndpointKey) => {
    const state = states[key];
    return state?.phase === "results" ? state.stops : [];
  };
  return { ready: true, origin: stopsOf("origin"), destination: stopsOf("destination") };
}

export const ENDPOINT_LABEL: Record<EndpointKey, string> = { origin: "출발지", destination: "목적지" };
