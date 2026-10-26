// 도착정보 프록시 (TASK-004·TASK-014, FR-005·FR-017, AC-005, D-04·D-22·D-25)
// GET /api/arrivals?stopId=… — 정류장 ID만 받는다. 좌표는 거부한다. 상류에는 키를 보내지 않는다.
// 응답 행을 도메인 형식으로 바꾸고 조회 시점의 데이터 나이를 붙인다. 정류장 일치·실시간 판정은 브라우저가 스냅샷으로 한다.
// 원문 응답·요청을 로그에 남기지 않는다.

import type { ArrivalsPayload, TimedArrival } from "../shared/arrivals.js";
import { ageSecondsAt } from "../shared/arrivals.js";
import { toArrival } from "../shared/bis-convert.js";
import { BIS_BASE_URL } from "./bis.js";
import { errorResponse, jsonResponse } from "./http.js";
import { hasCoordinateParams, parseStopId } from "./request-guard.js";
import { extractItems, firstTag } from "./xml-summary.js";

const TIMEOUT_MS = 8_000;
// 상류 갱신 주기 30초(GATE-04)의 절반만 CDN에 둔다 — 같은 정류장 요청을 묶어 상류 호출을 줄인다(D-11·D-22).
// 15초는 미확정 설정값(TASK-019·020에서 호출량과 함께 조정). 캐시 체류 시간은 Age 헤더로 브라우저가 나이에 더한다
export const ARRIVALS_CACHE_CONTROL = "public, max-age=0, s-maxage=15";

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export function createArrivalsHandler(fetchImpl: FetchLike = fetch, now: () => number = Date.now) {
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

    let body: string;
    try {
      const res = await fetchImpl(`${BIS_BASE_URL}BusArrives?station=${stopId}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return errorResponse(502, { status: "unavailable", code: "upstream_http_error" });
      body = await res.text();
    } catch (error) {
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return timeout
        ? errorResponse(504, { status: "unavailable", code: "upstream_timeout" })
        : errorResponse(502, { status: "unavailable", code: "upstream_unreachable" });
    }
    if (firstTag(body, "resultCode") !== "00") {
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
      arrivals.push({ ...arrival, ageSecondsAtFetch: age });
    }
    const payload: ArrivalsPayload = { status: "ok", stopId, fetchedAt: new Date(fetchedMs).toISOString(), arrivals, invalidRows };
    return jsonResponse(200, payload, { "Cache-Control": ARRIVALS_CACHE_CONTROL });
  };
}

export const handleArrivalsRequest = createArrivalsHandler();
