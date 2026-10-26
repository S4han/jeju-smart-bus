// 서버 함수 입력 검증 (TASK-004, PRIV-001·002, D-01·D-22)
// 서버는 사용자 좌표를 받지 않는다. 좌표성 파라미터가 오면 값을 읽지도 기록하지도 않고 거부한다.

const COORDINATE_PARAM_NAMES = new Set([
  "lat",
  "lng",
  "lon",
  "long",
  "latitude",
  "longitude",
  "x",
  "y",
  "coord",
  "coords",
  "coordinate",
  "coordinates",
  "position",
  "location",
  "geo",
  "gps",
  "mapx",
  "mapy",
]);

export function hasCoordinateParams(params: URLSearchParams): boolean {
  for (const name of params.keys()) {
    if (COORDINATE_PARAM_NAMES.has(name.toLowerCase())) return true;
  }
  return false;
}

// 정류장 ID 형식: 실데이터(스냅샷 정류장 4,352개, 2026-10-26) 전부 숫자 9자리(TASK-014)
const STOP_ID_PATTERN = /^\d{9}$/;

export function parseStopId(params: URLSearchParams): string | null {
  const values = params.getAll("stopId");
  if (values.length !== 1) return null;
  return STOP_ID_PATTERN.test(values[0]) ? values[0] : null;
}

// 노선 ID 형식: 실데이터(스냅샷 노선 991개, 2026-10-26) 전부 숫자 9자리(TASK-017, D-30). 없으면 undefined, 형식이 틀리면 null
const ROUTE_ID_PATTERN = /^\d{9}$/;

export function parseRouteId(params: URLSearchParams): string | null | undefined {
  const values = params.getAll("routeId");
  if (values.length === 0) return undefined;
  if (values.length !== 1) return null;
  return ROUTE_ID_PATTERN.test(values[0]) ? values[0] : null;
}
