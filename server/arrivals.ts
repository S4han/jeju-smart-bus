// 도착정보 프록시 (TASK-004·TASK-014, FR-005·FR-017, AC-005, D-04·D-22·D-25)
// GET /api/arrivals?stopId=… — 정류장 ID만 받는다. 좌표는 거부한다. 상류에는 키를 보내지 않는다.
// GET /api/arrivals?routeId=…&stopId=… — 노선 단위 예측(D-30, GATE-05). 상류 BusArriveInfo는 station 값을 무시하지만 필수라
// 그 노선의 정류장 ID를 함께 받아 그대로 넘긴다. 응답 행에 예측 대상 정류장 ID를 붙인다.
// 응답 행을 도메인 형식으로 바꾸고 조회 시점의 데이터 나이를 붙인다. 정류장 일치·실시간 판정은 브라우저가 스냅샷으로 한다.
// 원문 응답·요청을 로그에 남기지 않는다.

import type { ArrivalsPayload, TimedArrival } from "../shared/arrivals.js";
import { ageSecondsAt } from "../shared/arrivals.js";
import { toArrival } from "../shared/bis-convert.js";
import { BIS_BASE_URL } from "./bis.js";
import { errorResponse, jsonResponse } from "./http.js";
import { hasCoordinateParams, parseRouteId, parseStopId } from "./request-guard.js";
import { extractItems, firstTag } from "./xml-summary.js";

const TIMEOUT_MS = 8_000;
// 상류 갱신 주기 30초(GATE-04)의 절반만 CDN에 둔다 — 같은 정류장 요청을 묶어 상류 호출을 줄인다(D-11·D-22).
// 15초는 미확정 설정값(TASK-019·020에서 호출량과 함께 조정). 캐시 체류 시간은 Age 헤더로 브라우저가 나이에 더한다
export const ARRIVALS_CACHE_CONTROL = "public, max-age=0, s-maxage=15";

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

// 한도·호출 제한 감지(FR-017, D-11 무상태 방식). 제주 BIS의 한도 초과 응답은 아직 관찰된 적이 없다(GATE-04 §4).
// 아래 매핑은 공공데이터포털 공통 코드(22 일일 한도 초과, 23 초당 한도 초과)와 HTTP 429를 대비한 **미검증** 대응이다
const QUOTA_RESULT_CODES = new Set(["22"]);
const RATE_LIMIT_RESULT_CODES = new Set(["23"]);
// 감지 뒤 이 함수 인스턴스에서 상류 호출을 멈추는 시간 — 인스턴스 간 공유되지 않는 보조 수단(R-09). 미확정 설정값
export const QUOTA_BLOCK_MS = 10 * 60_000;
export const RATE_LIMIT_BLOCK_MS = 5_000;
// 한도 소진 응답을 CDN에 짧게 두어 같은 정류장 반복 호출을 줄이려는 헤더. Vercel이 503을 캐시하는지는 미검증
export const QUOTA_CACHE_CONTROL = "public, max-age=0, s-maxage=60";

export function createArrivalsHandler(fetchImpl: FetchLike = fetch, now: () => number = Date.now) {
  let blocked: { until: number; kind: "quota_exhausted" | "rate_limited" } | null = null;
  const limited = (kind: "quota_exhausted" | "rate_limited") =>
    kind === "quota_exhausted"
      ? errorResponse(503, { status: "quota_exhausted", code: "upstream_quota_exhausted" }, { "Cache-Control": QUOTA_CACHE_CONTROL })
      : errorResponse(429, { status: "rate_limited", code: "upstream_rate_limited" }, { "Retry-After": String(RATE_LIMIT_BLOCK_MS / 1000) });
  const block = (kind: "quota_exhausted" | "rate_limited") => {
    blocked = { kind, until: now() + (kind === "quota_exhausted" ? QUOTA_BLOCK_MS : RATE_LIMIT_BLOCK_MS) };
    return limited(kind);
  };

  return async function handleArrivalsRequest(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return errorResponse(405, { status: "invalid_input", code: "method_not_allowed" }, { Allow: "GET" });
    }
    const params = new URL(request.url).searchParams;
    if (hasCoordinateParams(params)) {
      return errorResponse(400, { status: "invalid_input", code: "location_not_accepted" });
    }
    const stopId = parseStopId(params);
    if (stopId === null) {
      return errorResponse(400, { status: "invalid_input", code: "invalid_stop_id" });
    }
    const routeId = parseRouteId(params);
    if (routeId === null) {
      return errorResponse(400, { status: "invalid_input", code: "invalid_route_id" });
    }

    // 한도 소진·호출 제한 감지 직후에는 상류를 다시 부르지 않는다(AC-017: 추가 호출 중단)
    if (blocked && now() < blocked.until) return limited(blocked.kind);
    blocked = null;

    let body: string;
    try {
      const upstream = routeId ? `BusArriveInfo?route=${routeId}&station=${stopId}` : `BusArrives?station=${stopId}`;
      const res = await fetchImpl(`${BIS_BASE_URL}${upstream}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 429) return block("rate_limited");
      if (!res.ok) return errorResponse(502, { status: "unavailable", code: "upstream_http_error" });
      body = await res.text();
    } catch (error) {
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return timeout
        ? errorResponse(504, { status: "unavailable", code: "upstream_timeout" })
        : errorResponse(502, { status: "unavailable", code: "upstream_unreachable" });
    }
    const resultCode = firstTag(body, "resultCode");
    if (resultCode && QUOTA_RESULT_CODES.has(resultCode)) return block("quota_exhausted");
    if (resultCode && RATE_LIMIT_RESULT_CODES.has(resultCode)) return block("rate_limited");
    if (resultCode !== "00") {
      return errorResponse(502, { status: "unavailable", code: "upstream_error" });
    }

    const fetchedMs = now();
    const arrivals: TimedArrival[] = [];
    let invalidRows = 0;
    for (const raw of extractItems(body).records) {
      const arrival = toArrival(raw);
      const age = arrival ? ageSecondsAt(arrival.calculatedAt, fetchedMs) : null;
      if (!arrival || age === null) {
        invalidRows++;
        continue;
      }
      if (routeId) {
        // 노선 단위: 요청한 노선 행만, 예측 대상 정류장 ID가 있어야 한다
        if (arrival.routeId !== routeId || !/^\d{9}$/.test(raw.arrvStationId ?? "")) {
          invalidRows++;
          continue;
        }
        arrivals.push({ ...arrival, ageSecondsAtFetch: age, stopId: raw.arrvStationId });
      } else {
        arrivals.push({ ...arrival, ageSecondsAtFetch: age });
      }
    }
    const payload: ArrivalsPayload = {
      status: "ok",
      stopId,
      ...(routeId ? { routeId } : {}),
      fetchedAt: new Date(fetchedMs).toISOString(),
      arrivals,
      invalidRows,
    };
    return jsonResponse(200, payload, { "Cache-Control": ARRIVALS_CACHE_CONTROL });
  };
}

export const handleArrivalsRequest = createArrivalsHandler();
