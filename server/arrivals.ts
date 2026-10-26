// 도착정보 프록시 골격 (TASK-004, FR-005·017, D-22)
// GET /api/arrivals?stopId=… — 정류장 ID만 받는다. 좌표는 거부한다.
// 버스 API 실호출은 TASK-005 검증 전이라 구현하지 않으며, 임의 데이터를 만들지 않는다(NFR-004).

import { readServerEnv } from "./env.js";
import { errorResponse } from "./http.js";
import { hasCoordinateParams, parseStopId } from "./request-guard.js";

export async function handleArrivalsRequest(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return errorResponse(405, { status: "invalid_input", code: "method_not_allowed" }, { Allow: "GET" });
  }

  const params = new URL(request.url).searchParams;
  if (hasCoordinateParams(params)) {
    return errorResponse(400, { status: "invalid_input", code: "location_not_accepted" });
  }
  if (parseStopId(params) === null) {
    return errorResponse(400, { status: "invalid_input", code: "invalid_stop_id" });
  }

  if (!readServerEnv().jejuBusApiKey) {
    return errorResponse(503, { status: "unavailable", code: "not_configured" });
  }

  // TASK-005에서 실제 응답 형식·오류 코드를 검증한 뒤 상류 호출과 정규화를 구현한다.
  return errorResponse(503, { status: "unavailable", code: "upstream_not_implemented" });
}
