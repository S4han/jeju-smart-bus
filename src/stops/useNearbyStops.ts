// 주변 정류장 결과 상태 — 지도와 목록이 이 하나의 상태를 함께 쓴다(TASK-013, AC-004)
import { useCallback, useEffect, useState } from "react";
import type { Coordinates, Stop } from "../../shared/domain";
import { declineExpansion, expandNearby, searchNearby, type NearbyState } from "./nearby";

export function useNearbyStops(stops: ReadonlyArray<Stop> | null, origin: Coordinates | null) {
  const [state, setState] = useState<NearbyState | null>(null);
  // 출발지가 바뀌면 500m부터 다시 찾는다(이전 확대 동의는 이어지지 않음)
  useEffect(() => setState(stops && origin ? searchNearby(stops, origin) : null), [stops, origin]);

  const expand = useCallback(() => {
    if (stops && origin) setState((s) => (s ? expandNearby(s, stops, origin) : s));
  }, [stops, origin]);
  const decline = useCallback(() => setState((s) => (s ? declineExpansion(s) : s)), []);

  return { state, expand, decline };
}
