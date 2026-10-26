// 선택한 정류장의 도착정보 상태 (TASK-014)
import { useCallback, useEffect, useState } from "react";
import type { ResultStatus, StopId } from "../../shared/domain";
import type { ArrivalsSnapshot } from "../data/httpArrivalSource";

export type ArrivalsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; snapshot: ArrivalsSnapshot }
  | { status: Exclude<ResultStatus, "ok"> };

interface ArrivalsLoader {
  getArrivals(stopId: StopId): Promise<{ status: "ok"; data: ArrivalsSnapshot } | { status: Exclude<ResultStatus, "ok"> }>;
}

export function useArrivals(source: ArrivalsLoader, stopId: StopId | null) {
  const [state, setState] = useState<ArrivalsState>({ status: "idle" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!stopId) {
      setState({ status: "idle" });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    source.getArrivals(stopId).then((result) => {
      if (active) setState(result.status === "ok" ? { status: "ready", snapshot: result.data } : { status: result.status });
    });
    return () => {
      active = false;
    };
  }, [source, stopId, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { state, refresh };
}

// 화면을 열어 둔 동안 실시간 여부를 다시 판정하도록 주기적으로 다시 그린다
export function useTicker(intervalMs: number, enabled: boolean): number {
  const [tick, setTick] = useState(() => performance.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick(performance.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return tick;
}
