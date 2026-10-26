// 서버 함수 공통 응답 형식 (TASK-004, FR-016·017, NFR-004)
// 결과 상태는 도메인 결과 상태(shared/domain.ts)를 그대로 쓴다.

import type { ResultStatus } from "../shared/domain.js";

export type ApiStatus = ResultStatus;

export interface ApiErrorBody {
  status: Exclude<ApiStatus, "ok" | "empty" | "stale">;
  code: string;
}

// 아직 캐시 가능한 성공 응답이 없으므로 기본은 no-store (PRIV-003).
// 정류장 ID 단위 성공 응답의 s-maxage 값은 GATE-04 이후 결정한다.
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
