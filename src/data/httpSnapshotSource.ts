// 정적 스냅샷을 내려받는 SnapshotSource (D-01·D-10)
// 전체 공개 데이터 파일 하나만 받는다 — 사용자 위치에 따라 다른 요청을 보내지 않는다(PRIV R-1)

import type { TransitSnapshot } from "../../shared/bis-convert";
import { failure, ok, type Result } from "../../shared/domain";
import type { SnapshotSource } from "../../shared/sources";

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function createHttpSnapshotSource(url: string, fetchImpl: FetchLike = (u) => fetch(u)): SnapshotSource {
  let pending: Promise<Result<TransitSnapshot>> | null = null;
  return {
    loadSnapshot() {
      pending ??= load(url, fetchImpl).then((result) => {
        // 실패는 기억하지 않아 다음 호출에서 다시 시도한다
        if (result.status !== "ok") pending = null;
        return result;
      });
      return pending;
    },
  };
}

async function load(url: string, fetchImpl: FetchLike): Promise<Result<TransitSnapshot>> {
  let body: unknown;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return failure("unavailable", `http_${res.status}`);
    body = await res.json();
  } catch {
    return failure("unavailable", "network_or_parse");
  }
  return isTransitSnapshot(body) ? ok(body) : failure("inconsistent", "schema_mismatch");
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// 형식이 맞지 않으면 일부라도 쓰지 않는다(NFR-004)
export function isTransitSnapshot(v: unknown): v is TransitSnapshot {
  if (!isRecord(v) || v.schemaVersion !== 1 || typeof v.generatedAt !== "string") return false;
  if (!Array.isArray(v.stops) || !Array.isArray(v.routes)) return false;
  const stopsOk = v.stops.every(
    (s) =>
      isRecord(s) &&
      typeof s.id === "string" &&
      typeof s.name === "string" &&
      (s.coordinates === null || (isRecord(s.coordinates) && isFiniteNumber(s.coordinates.lat) && isFiniteNumber(s.coordinates.lng))),
  );
  const routesOk = v.routes.every(
    (r) => isRecord(r) && typeof r.id === "string" && typeof r.name === "string" && Array.isArray(r.stopIds) && r.stopIds.every((id) => typeof id === "string"),
  );
  return stopsOk && routesOk;
}
