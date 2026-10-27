// 도메인 모델 (TASK-009, NFR-004)
// "검증되지 않은 정보를 만들지 않는다"를 타입으로 강제한다:
// - 좌표는 확인된 경우에만 존재한다(없으면 null — 임의 위치 금지, AC-004·AC-020)
// - 시간 값은 출처(실시간/추정)와 함께만 존재한다(AC-010·AC-014)

export type StopId = string;
export type RouteId = string;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Stop {
  id: StopId;
  name: string;
  // null = 좌표 확인 불가(D-24). 지도·반경 검색에서 제외하고 목록에는 남긴다
  coordinates: Coordinates | null;
  // BIS Station dirTp 원문(N·S·E·W만, 그 밖의 값은 두지 않음) — 정류장 방향 표시용(TASK-030, 의미는 실데이터로 검증)
  direction?: StopDirection;
}

export type StopDirection = "N" | "S" | "E" | "W";

// 운행 방향은 노선 ID로 구분되고 stopIds 순서가 운행 순서다(GATE-02-03.md §2, D-21)
export interface Route {
  id: RouteId;
  name: string;
  subName: string | null;
  type: string | null;
  // BIS Bus routeNum 원문(예: routeNm "5000-1" → "5000") — 화면 표시용 번호(TASK-030)
  number?: string;
  stopIds: StopId[];
}

export type TimeSource = "realtime" | "estimated";

export interface TimeComponent {
  minutes: number;
  source: TimeSource;
}

export interface Arrival {
  routeId: RouteId;
  // 노선 내 정류장 순번(1부터). 요청 정류장과 일치하는지는 스냅샷 노선으로 확인한다(AC-005)
  stopOrder: number;
  // 도착 예정 차량이 없으면 null(상류 arrvVhId=0) — 시간도 만들지 않는다
  vehicleId: string | null;
  minutesToArrival: number | null;
  stopsAway: number | null;
  // 상류 산출 시각(ISO 8601, UTC로 정규화). 신선도 판정(D-04)은 shared/arrivals.ts
  calculatedAt: string;
  source: "realtime";
}

export type ResultStatus =
  | "ok"
  | "empty"
  | "stale"
  | "inconsistent"
  | "unavailable"
  | "quota_exhausted"
  | "rate_limited"
  | "invalid_input";

export type Result<T> =
  | { status: "ok"; data: T }
  | { status: Exclude<ResultStatus, "ok">; reason?: string };

export const ok = <T>(data: T): Result<T> => ({ status: "ok", data });
export const failure = <T>(status: Exclude<ResultStatus, "ok">, reason?: string): Result<T> =>
  reason === undefined ? { status } : { status, reason };
