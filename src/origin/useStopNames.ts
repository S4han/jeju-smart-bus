// 정류장명 검색용 정류장 목록 (TASK-011, FR-002)
// 스냅샷을 받지 못하면 목록을 만들지 않고 "제공 불가" 상태로 둔다(NFR-004)
import { useEffect, useState } from "react";
import type { Stop } from "../../shared/domain";
import type { SnapshotSource } from "../../shared/sources";

export type StopListState = { status: "loading" } | { status: "ready"; stops: Stop[] } | { status: "unavailable" };

export function useStopNames(source: SnapshotSource): StopListState {
  const [state, setState] = useState<StopListState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    source.loadSnapshot().then(
      (result) => {
        if (active) setState(result.status === "ok" ? { status: "ready", stops: result.data.stops } : { status: "unavailable" });
      },
      () => {
        if (active) setState({ status: "unavailable" });
      },
    );
    return () => {
      active = false;
    };
  }, [source]);
  return state;
}
