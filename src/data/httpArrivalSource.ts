// 도착정보 요청 (TASK-014, FR-005, D-22) — 정류장 ID만 보낸다. 좌표·출발지는 보내지 않는다
import type { ArrivalsPayload } from "../../shared/arrivals";
import { failure, ok, type Result, type ResultStatus, type RouteId, type StopId } from "../../shared/domain";

export interface ArrivalsSnapshot {
  payload: ArrivalsPayload;
  // CDN 캐시에 머문 시간(Age 헤더, 초). 없으면 0
  cacheAgeSeconds: number;
  // 받은 시점(performance.now 기준 ms) — 기기 시계와 무관하게 경과 시간을 잰다
  receivedAtMs: number;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

// 재시도(FR-017): 호출 제한·일시 장애만 지수 백오프로 최대 2번 더(1초, 2초). 한도 소진은 재시도하지 않는다. 미확정 설정값
export const RETRY_DELAYS_MS = [1_000, 2_000];
// 한도 소진을 받으면 이 브라우저에서 도착정보 요청을 멈추는 시간. 미확정 설정값
export const QUOTA_PAUSE_MS = 10 * 60_000;

type Failure = { status: Exclude<ResultStatus, "ok">; reason: string };

export function createHttpArrivalSource(
  fetchImpl: FetchLike = (u) => fetch(u),
  clock: () => number = () => performance.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  let pausedUntil = -Infinity;

  async function once(stopId: StopId, routeId?: RouteId): Promise<Result<ArrivalsSnapshot> | Failure> {
    let body: unknown;
    let cacheAgeSeconds = 0;
    const query = `stopId=${encodeURIComponent(stopId)}${routeId ? `&routeId=${encodeURIComponent(routeId)}` : ""}`;
    try {
      const res = await fetchImpl(`/api/arrivals?${query}`);
      if (!res.ok) {
        const status = await res.json().then((b) => (isRecord(b) ? b.status : null)).catch(() => null);
        if (res.status === 400) return { status: "invalid_input", reason: "http_400" };
        if (res.status === 429 || status === "rate_limited") return { status: "rate_limited", reason: `http_${res.status}` };
        if (status === "quota_exhausted") return { status: "quota_exhausted", reason: `http_${res.status}` };
        return { status: "unavailable", reason: `http_${res.status}` };
      }
      const age = Number(res.headers.get("Age"));
      cacheAgeSeconds = Number.isFinite(age) && age > 0 ? age : 0;
      body = await res.json();
    } catch {
      return { status: "unavailable", reason: "network_or_parse" };
    }
    if (!isPayload(body) || body.stopId !== stopId || body.routeId !== routeId) return failure("inconsistent", "payload_mismatch");
    if (routeId && !body.arrivals.every((a) => typeof a.stopId === "string" && a.routeId === routeId)) return failure("inconsistent", "payload_mismatch");
    return ok({ payload: body, cacheAgeSeconds, receivedAtMs: clock() });
  }

  async function withRetry(stopId: StopId, routeId?: RouteId): Promise<Result<ArrivalsSnapshot>> {
      // 한도 소진 뒤에는 요청 자체를 보내지 않는다(AC-017)
      if (clock() < pausedUntil) return failure("quota_exhausted", "paused");
      for (let attempt = 0; ; attempt++) {
        const result = await once(stopId, routeId);
        if (result.status === "quota_exhausted") pausedUntil = clock() + QUOTA_PAUSE_MS;
        const retryable = result.status === "rate_limited" || (result.status === "unavailable" && result.reason !== "http_502");
        if (!retryable || attempt >= RETRY_DELAYS_MS.length) return result as Result<ArrivalsSnapshot>;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
  }

  return {
    getArrivals: (stopId: StopId) => withRetry(stopId),
    // 노선 단위 예측(D-30, GATE-05). stopId는 그 노선의 정류장(상류 필수 값)
    getRoutePredictions: (routeId: RouteId, stopId: StopId) => withRetry(stopId, routeId),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isPayload(v: unknown): v is ArrivalsPayload {
  if (!isRecord(v) || v.status !== "ok" || typeof v.stopId !== "string" || !Array.isArray(v.arrivals)) return false;
  if (v.routeId !== undefined && typeof v.routeId !== "string") return false;
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
      Number.isFinite(a.ageSecondsAtFetch) &&
      (a.stopId === undefined || typeof a.stopId === "string"),
  );
}
