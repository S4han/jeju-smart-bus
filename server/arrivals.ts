// 도착정보 프록시 골격 (TASK-004, FR-005·017, D-22)
// GET /api/arrivals?stopId=… — 정류장 ID만 받는다. 좌표는 거부한다.
// 상류 호출·정규화는 TASK-014에서 구현한다. 그 전까지 임의 데이터를 만들지 않는다(NFR-004).
// 버스 API는 키 없이 호출한다(D-25).

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

  return errorResponse(503, { status: "unavailable", code: "upstream_not_implemented" });
}
