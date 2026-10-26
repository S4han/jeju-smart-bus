// 현재 위치 요청 상태 훅 (TASK-011, FR-001, AC-001)
// 위치 권한은 사용자가 안내를 읽고 "위치 사용"을 누른 뒤에만 요청한다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinates } from "../../shared/domain";
import { browserGeolocation, requestCurrentPosition, type LocationFailure } from "./geolocation";

export type LocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "ok"; coordinates: Coordinates }
  | { status: LocationFailure };

export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const request = useCallback(() => {
    setState({ status: "requesting" });
    requestCurrentPosition(browserGeolocation()).then((outcome) => {
      if (active.current) setState(outcome);
    });
  }, []);

  return { state, request };
}
