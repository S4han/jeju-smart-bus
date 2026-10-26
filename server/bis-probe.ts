// 제주 BIS 실응답 검증용 임시 프로브 (TASK-005·006·007, GATE-01~05, U-006) — 검증 TASK 종료 후 삭제
// 미리보기 배포에서만 동작한다. 응답 원문 대신 요약만 돌려주고, 로그를 남기지 않는다. 키는 보내지 않는다(D-25).

import { buildSnapshot } from "../shared/bis-convert.js";
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
  // TASK-007(GATE-05): 구간 이동시간 근거 확인용
  BusArriveList: ["route", "from", "to"],
  BusArriveInfo: ["route", "station"],
};
// 구간 분석에 행 전체가 필요한 오퍼레이션(차량·정류장 ID와 예측 분만 — 좌표·개인정보 없음)
const FULL_ROW_OPS = new Set(["BusArriveList", "BusArriveInfo"]);
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
  if (op === "SnapshotStats") return handleSnapshotStats();
  const allowed = OPERATIONS[op];
  if (!allowed) return errorResponse(400, { status: "invalid_input", code: "operation_not_allowed" });

  const sampleSize = Math.min(Math.max(Number(params.get("sample") ?? 3) || 0, 0), FULL_ROW_OPS.has(op) ? 200 : 5);
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

type Fetched = Record<string, ReturnType<typeof extractItems> & { bytes: number; resultCode: string | null }>;

async function fetchAll(): Promise<Fetched | Response> {
  const fetched: Fetched = {};
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
  return fetched;
}

// TASK-006: Station·Bus·StationRoute 전체를 받아 정합성 분석 결과만 돌려준다(상류 호출 3회)
async function handleAnalysis(activeRowsOnly: boolean): Promise<Response> {
  const started = Date.now();
  const fetched = await fetchAll();
  if (fetched instanceof Response) return fetched;
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

// TASK-009: 가공 규칙(D-24·D-26)으로 정적 스냅샷을 만들어 크기·통계만 돌려준다(데이터 자체는 반환하지 않음 — D-10 미결)
async function handleSnapshotStats(): Promise<Response> {
  const started = Date.now();
  const fetched = await fetchAll();
  if (fetched instanceof Response) return fetched;
  const { snapshot, stats } = buildSnapshot(
    fetched.Station.records,
    fetched.Bus.records,
    fetched.StationRoute.records,
    new Date().toISOString(),
  );
  const json = JSON.stringify(snapshot);
  const gzipBytes = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer().then((b) => b.byteLength);
  return jsonResponse(200, {
    op: "SnapshotStats",
    durationMs: Date.now() - started,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    stats,
    size: { jsonBytes: new TextEncoder().encode(json).byteLength, gzipBytes },
    sample: { stop: snapshot.stops[0] ?? null, route: snapshot.routes[0] ? { ...snapshot.routes[0], stopIds: snapshot.routes[0].stopIds.slice(0, 3) } : null },
  });
}
