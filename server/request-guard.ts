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

// 정류장 ID 형식은 실제 응답 검증(TASK-005, GATE-01) 전이라 미확정이다.
// 그때까지는 경로 조작·주입을 막는 수준의 보수적 패턴만 적용한다.
const STOP_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function parseStopId(params: URLSearchParams): string | null {
  const values = params.getAll("stopId");
  if (values.length !== 1) return null;
  return STOP_ID_PATTERN.test(values[0]) ? values[0] : null;
}
