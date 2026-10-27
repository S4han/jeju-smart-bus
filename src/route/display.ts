// 경로 화면 표시 형식(TASK-030). 값을 만들지 않고 스냅샷·계산 결과를 읽기 좋게만 바꾼다
import type { Route, StopDirection } from "../../shared/domain";

// 노선 표시 번호(D-34): BIS routeNum이 노선 이름의 앞부분일 때만 사용(254-1 → 254, 251-5 → 251).
// 실데이터 991개 중 180개는 routeNum이 이름 앞부분과 다름(예: 43-1 → 43-2) — 그때는 이름 그대로(docs/verification/TASK-030.md)
function displayNumber(route: Pick<Route, "name" | "number"> | undefined): string | null {
  const n = route?.number;
  return n && route && (route.name === n || route.name.startsWith(`${n}-`)) ? n : null;
}

export function routeNumber(route: Pick<Route, "name" | "number"> | undefined, fallbackId: string): string {
  return displayNumber(route) ?? route?.name ?? `노선 ${fallbackId}`;
}

// 세부 노선 이름이 표시 번호와 다르면 작게 함께 보여 준다(예: 254 옆 "254-1")
export function routeVariant(route: Pick<Route, "name" | "number"> | undefined): string | null {
  const n = displayNumber(route);
  return n && route && route.name !== n ? route.name : null;
}

// 정류장 방향(BIS Station dirTp "정류소 방향") 표기 — 원문 코드를 [동]·[서]·[남]·[북]으로만 옮긴다.
// 실데이터: 정존마을 405000444 = W, NAVER 지도 표기 "정존마을[서]"와 일치. 버스 진행 방향이 아니라 정류소 방향 코드다(docs/verification/TASK-030.md)
export const STOP_DIRECTION_VERIFIED = true;
const DIRECTION_LABEL: Record<StopDirection, string> = { N: "북", S: "남", E: "동", W: "서" };
export function directionLabel(direction: StopDirection | undefined): string | null {
  return STOP_DIRECTION_VERIFIED && direction ? DIRECTION_LABEL[direction] : null;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ""}` : `${m}분`;
}

const CLOCK = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
export function formatClock(epochMs: number): string {
  return CLOCK.format(new Date(epochMs));
}

// 정류장 이름 + 정류소 방향 코드(있을 때만) — 예: "정존마을[서]"
export function stopNameWithDirection(stop: { name: string; direction?: StopDirection }): string {
  const dir = directionLabel(stop.direction);
  return dir ? `${stop.name}[${dir}]` : stop.name;
}
