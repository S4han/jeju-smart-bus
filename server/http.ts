// 서버 함수 공통 응답 형식 (TASK-004, FR-016·017, NFR-004)
// 결과 상태는 도메인 결과 상태(shared/domain.ts)를 그대로 쓴다.

import type { ResultStatus } from "../shared/domain.js";

export type ApiStatus = ResultStatus;

export interface ApiErrorBody {
  status: Exclude<ApiStatus, "ok" | "empty" | "stale">;
  code: string;
}

// 기본은 no-store (PRIV-003). 정류장 ID 단위 도착정보 성공 응답만 짧게 CDN 캐시한다(server/arrivals.ts)
export const NO_STORE = "no-store";

export function jsonResponse(
  httpStatus: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
      ...headers,
    },
  });
}

export function errorResponse(
  httpStatus: number,
  body: ApiErrorBody,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(httpStatus, body, headers);
}
