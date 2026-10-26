// 정류장 이름 검색 (TASK-011, FR-002, D-05) — 브라우저 안에서만 수행(네트워크 없음)
// 스냅샷에 있는 정류장만 결과가 된다. 이름을 만들거나 고치지 않는다.

import type { Stop } from "../../shared/domain";

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

// 부분 일치. 앞부분 일치 → 짧은 이름 → 가나다 → 정류장 ID 순
export function searchStops(stops: ReadonlyArray<Stop>, query: string, limit = STOP_SEARCH_LIMIT): StopSearchResult[] {
  const q = normalizeStopName(query);
  if (q.length === 0) return [];
  const matches: Array<{ stop: Stop; name: string; prefix: boolean }> = [];
  for (const stop of stops) {
    const name = normalizeStopName(stop.name);
    const index = name.indexOf(q);
    if (index >= 0) matches.push({ stop, name, prefix: index === 0 });
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
