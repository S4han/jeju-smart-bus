// 현재 위치 요청 (TASK-011, FR-001, AC-001, PRIV-001~003)
// 좌표는 호출한 쪽의 메모리 상태로만 전달한다. 저장·URL·서버 전송·로그 출력을 하지 않는다.

import type { Coordinates } from "../../shared/domain";

export type LocationFailure = "unsupported" | "denied" | "unavailable" | "timeout" | "invalid";

export type LocationOutcome = { status: "ok"; coordinates: Coordinates } | { status: LocationFailure };

// 미확정 설정값 — 시간 초과·캐시 허용 시간은 TASK-020 실사용 점검에서 조정한다
export const LOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 };

type GeolocationLike = Pick<Geolocation, "getCurrentPosition">;

export function isValidCoordinates(c: { lat: number; lng: number }): boolean {
  return Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
}

export function requestCurrentPosition(
  geolocation: GeolocationLike | undefined,
  options: PositionOptions = LOCATION_OPTIONS,
): Promise<LocationOutcome> {
  if (!geolocation) return Promise.resolve({ status: "unsupported" });
  return new Promise((resolve) => {
    try {
      geolocation.getCurrentPosition(
        (position) => {
          const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
          resolve(isValidCoordinates(coordinates) ? { status: "ok", coordinates } : { status: "invalid" });
        },
        (error) => resolve({ status: failureFromCode(error.code) }),
        options,
      );
    } catch {
      resolve({ status: "unavailable" });
    }
  });
}

// GeolocationPositionError: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
function failureFromCode(code: number): LocationFailure {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

export function browserGeolocation(): GeolocationLike | undefined {
  try {
    return typeof navigator !== "undefined" && "geolocation" in navigator ? navigator.geolocation : undefined;
  } catch {
    return undefined;
  }
}

export const LOCATION_MESSAGES: Record<LocationFailure, string> = {
  unsupported: "이 브라우저에서는 현재 위치를 사용할 수 없습니다. 출발지를 직접 선택해 주세요.",
  denied: "위치 권한이 허용되지 않았습니다. 출발지를 직접 선택해 주세요.",
  unavailable: "현재 위치를 확인하지 못했습니다. 다시 시도하거나 출발지를 직접 선택해 주세요.",
  timeout: "현재 위치 확인 시간이 초과되었습니다. 다시 시도하거나 출발지를 직접 선택해 주세요.",
  invalid: "확인된 위치 값이 올바르지 않습니다. 다시 시도하거나 출발지를 직접 선택해 주세요.",
};
