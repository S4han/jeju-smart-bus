// 정류장 이름 검색 (TASK-011, FR-002, D-05) — 브라우저 안에서만 수행(네트워크 없음)
// 스냅샷에 있는 정류장만 결과가 된다. 이름을 만들거나 고치지 않는다.

import type { Route, Stop, StopId } from "../../shared/domain";

export interface StopSearchResult {
  stop: Stop;
  // 좌표 확인 불가 정류장은 목록에 보이되 출발지로 고를 수 없다(D-24)
  selectable: boolean;
}

// 미확정 설정값 — 결과 개수는 TASK-020 실사용 점검에서 조정한다
export const STOP_SEARCH_LIMIT = 20;

export function normalizeStopName(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

// 글자가 순서대로 모두 들어 있는지("제주공항" → "제주국제공항"). 부분 일치가 없을 때만 쓴다(TASK-028)
export const FUZZY_MIN_LENGTH = 3;
function isSubsequence(q: string, name: string): boolean {
  let i = 0;
  for (const ch of name) if (ch === q[i]) i++;
  return i === q.length;
}

// 부분 일치. 앞부분 일치 → 짧은 이름 → 가나다 → 정류장 ID 순. 부분 일치가 없으면 순서대로 포함(3글자 이상)
export function searchStops(stops: ReadonlyArray<Stop>, query: string, limit = STOP_SEARCH_LIMIT): StopSearchResult[] {
  const q = normalizeStopName(query);
  if (q.length === 0) return [];
  const matches: Array<{ stop: Stop; name: string; prefix: boolean }> = [];
  for (const stop of stops) {
    const name = normalizeStopName(stop.name);
    const index = name.indexOf(q);
    if (index >= 0) matches.push({ stop, name, prefix: index === 0 });
  }
  if (matches.length === 0 && [...q].length >= FUZZY_MIN_LENGTH) {
    for (const stop of stops) {
      const name = normalizeStopName(stop.name);
      if (isSubsequence(q, name)) matches.push({ stop, name, prefix: name.startsWith(q[0]) });
    }
  }
  matches.sort(
    (a, b) =>
      Number(b.prefix) - Number(a.prefix) ||
      a.name.length - b.name.length ||
      a.stop.name.localeCompare(b.stop.name, "ko") ||
      a.stop.id.localeCompare(b.stop.id),
  );
  return matches.slice(0, limit).map(({ stop }) => ({ stop, selectable: stop.coordinates !== null }));
}

// 같은 이름 정류장 구분용 방향 힌트(TASK-028): 이 정류장을 지나는 노선에서 바로 다음 정류장 이름(스냅샷 노선 순서 그대로)
export function nextStopNames(routes: ReadonlyArray<Route>, stopsById: ReadonlyMap<StopId, Stop>): Map<StopId, string[]> {
  const next = new Map<StopId, Set<string>>();
  for (const route of routes) {
    for (let i = 0; i + 1 < route.stopIds.length; i++) {
      const name = stopsById.get(route.stopIds[i + 1])?.name;
      if (!name || name === stopsById.get(route.stopIds[i])?.name) continue;
      let set = next.get(route.stopIds[i]);
      if (!set) next.set(route.stopIds[i], (set = new Set()));
      set.add(name);
    }
  }
  return new Map([...next].map(([id, names]) => [id, [...names].sort((a, b) => a.localeCompare(b, "ko"))]));
}
