// 도착정보 요청 (TASK-014, FR-005, D-22) — 정류장 ID만 보낸다. 좌표·출발지는 보내지 않는다
import type { ArrivalsPayload } from "../../shared/arrivals";
import { failure, ok, type Result, type StopId } from "../../shared/domain";

export interface ArrivalsSnapshot {
  payload: ArrivalsPayload;
  // CDN 캐시에 머문 시간(Age 헤더, 초). 없으면 0
  cacheAgeSeconds: number;
  // 받은 시점(performance.now 기준 ms) — 기기 시계와 무관하게 경과 시간을 잰다
  receivedAtMs: number;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

export function createHttpArrivalSource(
  fetchImpl: FetchLike = (u) => fetch(u),
  clock: () => number = () => performance.now(),
) {
  return {
    async getArrivals(stopId: StopId): Promise<Result<ArrivalsSnapshot>> {
      let body: unknown;
      let cacheAgeSeconds = 0;
      try {
        const res = await fetchImpl(`/api/arrivals?stopId=${encodeURIComponent(stopId)}`);
        if (!res.ok) return failure(res.status === 400 ? "invalid_input" : "unavailable", `http_${res.status}`);
        const age = Number(res.headers.get("Age"));
        cacheAgeSeconds = Number.isFinite(age) && age > 0 ? age : 0;
        body = await res.json();
      } catch {
        return failure("unavailable", "network_or_parse");
      }
      if (!isPayload(body) || body.stopId !== stopId) return failure("inconsistent", "payload_mismatch");
      return ok({ payload: body, cacheAgeSeconds, receivedAtMs: clock() });
    },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isPayload(v: unknown): v is ArrivalsPayload {
  if (!isRecord(v) || v.status !== "ok" || typeof v.stopId !== "string" || !Array.isArray(v.arrivals)) return false;
  return v.arrivals.every(
    (a) =>
      isRecord(a) &&
      typeof a.routeId === "string" &&
      Number.isInteger(a.stopOrder) &&
      (a.vehicleId === null || typeof a.vehicleId === "string") &&
      (a.minutesToArrival === null || typeof a.minutesToArrival === "number") &&
      (a.stopsAway === null || typeof a.stopsAway === "number") &&
      typeof a.calculatedAt === "string" &&
      typeof a.ageSecondsAtFetch === "number" &&
      Number.isFinite(a.ageSecondsAtFetch),
  );
}
