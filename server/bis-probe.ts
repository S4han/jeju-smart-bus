// 제주 BIS 실응답 검증용 임시 프로브 (TASK-005·006, GATE-01~04, U-006) — TASK-006 종료 후 삭제
// 미리보기 배포에서만 동작한다. 응답 원문 대신 요약만 돌려주고, 로그를 남기지 않는다. 키는 보내지 않는다(D-25).

import { busFieldStats, nearbyStationStats, outOfRangeStations, routeIntegrity } from "./bis-analysis.js";
import { readServerEnv } from "./env.js";
import { errorResponse, jsonResponse } from "./http.js";
import { maskSecrets } from "./secrets.js";
import {
  coordinateQuality,
  distinctValues,
  extractItems,
  fieldNames,
  firstTag,
  numericRange,
  stringRange,
} from "./xml-summary.js";

const BASE_URL = "http://busopen.jeju.go.kr/OpenAPI/service/bis/";
const TIMEOUT_MS = 30_000;

// 명세(BIS-API-spec-summary.md §2)의 조회 오퍼레이션 중 TASK-005 계획에 있는 것만 허용
const OPERATIONS: Record<string, ReadonlyArray<string>> = {
  Station: ["last"],
  Station2: ["last"],
  Bus: ["last"],
  StationRoutePr: ["route"],
  StationRoute: ["last"],
  BusArrives: ["station"],
  BusInfo: ["route"],
};
const PAGING = ["pageNo", "numOfRows"];
const PARAM_VALUE = /^[A-Za-z0-9 :_-]{0,32}$/;

const NUMERIC_FIELDS = ["localX", "localY", "stationOrd", "predictTravTm", "leftStation", "routeDist"];
const CATEGORY_FIELDS = ["updnDir", "useYn", "dirTp", "routeTp", "govNm", "holidayTp"];
const DATE_FIELDS = ["calcDate", "upd"];

export async function handleBisProbe(request: Request): Promise<Response> {
  const env = readServerEnv();
  if (env.vercelEnv !== "preview") {
    return errorResponse(404, { status: "unavailable", code: "not_found" });
  }
  if (request.method !== "GET") {
    return errorResponse(405, { status: "invalid_input", code: "method_not_allowed" }, { Allow: "GET" });
  }

  const params = new URL(request.url).searchParams;
  const op = params.get("op") ?? "";
  if (op === "Analysis") return handleAnalysis(params.get("activeRowsOnly") === "1");
  const allowed = OPERATIONS[op];
  if (!allowed) return errorResponse(400, { status: "invalid_input", code: "operation_not_allowed" });

  const sampleSize = Math.min(Math.max(Number(params.get("sample") ?? 3) || 0, 0), 5);
  // 샘플만 사용 중(useYn=Y) 항목으로 좁힐 때 사용. 통계는 전체 기준
  const sampleInUse = params.get("sampleInUse") === "1";

  const upstreamQuery: string[] = [];
  for (const name of [...allowed, ...PAGING]) {
    const value = params.get(name);
    if (value === null) continue;
    if (!PARAM_VALUE.test(value)) return errorResponse(400, { status: "invalid_input", code: "invalid_param" });
    upstreamQuery.push(`${name}=${encodeURIComponent(value)}`);
  }

  const url = `${BASE_URL}${op}${upstreamQuery.length ? `?${upstreamQuery.join("&")}` : ""}`;
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
    return jsonResponse(502, { status: "unavailable", code: "upstream_unreachable", reason: maskSecrets(reason, []) });
  }
  const body = await res.text();
  const { itemTag, records } = extractItems(body);

  return jsonResponse(200, {
    op,
    request: maskSecrets(url, []),
    upstream: {
      httpStatus: res.status,
      contentType: res.headers.get("content-type"),
      bytes: body.length,
      durationMs: Date.now() - started,
      head: maskSecrets(body.slice(0, 400), []),
    },
    header: {
      resultCode: firstTag(body, "resultCode") ?? null,
      resultMsg: firstTag(body, "resultMsg") ?? null,
      returnAuthMsg: firstTag(body, "returnAuthMsg") ?? null,
      returnReasonCode: firstTag(body, "returnReasonCode") ?? null,
    },
    paging: {
      totalCount: firstTag(body, "totalCount") ?? null,
      numOfRows: firstTag(body, "numOfRows") ?? null,
      pageNo: firstTag(body, "pageNo") ?? null,
    },
    items: {
      itemTag,
      count: records.length,
      fields: fieldNames(records),
      numeric: Object.fromEntries(
        NUMERIC_FIELDS.filter((f) => records.some((r) => f in r)).map((f) => [f, numericRange(records, f)]),
      ),
      categories: Object.fromEntries(
        CATEGORY_FIELDS.filter((f) => records.some((r) => f in r)).map((f) => [f, distinctValues(records, f)]),
      ),
      dates: Object.fromEntries(
        DATE_FIELDS.filter((f) => records.some((r) => f in r)).map((f) => [f, stringRange(records, f)]),
      ),
      coordinates: records.some((r) => "localX" in r) ? coordinateQuality(records, "stationId") : undefined,
      sample: (sampleInUse ? records.filter((r) => r.useYn === "Y") : records).slice(0, sampleSize),
    },
  });
}

// TASK-006: Station·Bus·StationRoute 전체를 받아 정합성 분석 결과만 돌려준다(상류 호출 3회)
async function handleAnalysis(activeRowsOnly: boolean): Promise<Response> {
  const started = Date.now();
  const fetched: Record<string, ReturnType<typeof extractItems> & { bytes: number; resultCode: string | null }> = {};
  for (const op of ["Station", "Bus", "StationRoute"]) {
    try {
      const res = await fetch(`${BASE_URL}${op}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = await res.text();
      fetched[op] = { ...extractItems(body), bytes: body.length, resultCode: firstTag(body, "resultCode") ?? null };
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
      return jsonResponse(502, { status: "unavailable", code: "upstream_unreachable", op, reason });
    }
  }
  const stations = fetched.Station.records;
  const buses = fetched.Bus.records;
  const stationRoutes = fetched.StationRoute.records;
  return jsonResponse(200, {
    op: "Analysis",
    durationMs: Date.now() - started,
    upstream: Object.fromEntries(
      Object.entries(fetched).map(([op, f]) => [op, { resultCode: f.resultCode, bytes: f.bytes, count: f.records.length, fields: fieldNames(f.records) }]),
    ),
    stationRouteDates: stringRange(stationRoutes, "upd"),
    stationRouteUseYn: distinctValues(stationRoutes, "useYn"),
    activeRowsOnly,
    routes: routeIntegrity(stations, buses, stationRoutes, { activeRowsOnly }),
    busFields: busFieldStats(buses),
    outOfRangeStations: outOfRangeStations(stations),
    nearby: nearbyStationStats(stations),
  });
}
