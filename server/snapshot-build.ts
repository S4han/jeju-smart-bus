// 정적 정류장·노선 스냅샷 생성 (TASK-009 후속, D-01·D-10·D-24·D-26)
// 빌드 시점에만 실행한다(vite.config.ts). 위치정보와 무관한 전체 공개 데이터만 받는다. 키는 보내지 않는다(D-25).
// 상류가 비정상이면 예외를 던져 빌드를 실패시킨다 — 운영에는 직전 배포가 유지된다.

import { buildSnapshot, type SnapshotStats, type TransitSnapshot } from "../shared/bis-convert.js";
import { BIS_BASE_URL } from "./bis.js";
import { extractItems, firstTag, type XmlRecord } from "./xml-summary.js";

export { BIS_BASE_URL };
const TIMEOUT_MS = 60_000;
const OPERATIONS = ["Station", "Bus", "StationRoute"] as const;

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function fetchSnapshot(
  fetchImpl: FetchLike = fetch,
  now: () => Date = () => new Date(),
): Promise<{ snapshot: TransitSnapshot; stats: SnapshotStats }> {
  const records: Partial<Record<(typeof OPERATIONS)[number], XmlRecord[]>> = {};
  for (const op of OPERATIONS) {
    const res = await fetchImpl(`${BIS_BASE_URL}${op}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`snapshot: ${op} HTTP ${res.status}`);
    const body = await res.text();
    const resultCode = firstTag(body, "resultCode");
    if (resultCode !== "00") throw new Error(`snapshot: ${op} resultCode ${resultCode ?? "없음"}`);
    const items = extractItems(body).records;
    if (items.length === 0) throw new Error(`snapshot: ${op} 0건`);
    records[op] = items;
  }
  const result = buildSnapshot(records.Station!, records.Bus!, records.StationRoute!, now().toISOString());
  // 가공 후 정류장·노선이 없으면 빈 데이터를 배포하지 않는다(NFR-004)
  if (result.stats.stops.included === 0 || result.stats.routes.included === 0) {
    throw new Error(`snapshot: 가공 결과 정류장 ${result.stats.stops.included}·노선 ${result.stats.routes.included}`);
  }
  return result;
}
