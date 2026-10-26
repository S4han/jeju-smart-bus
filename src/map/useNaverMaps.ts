// NAVER 지도 SDK 로드 상태 훅 (TASK-010, TASK-021)
// enabled가 false이면(지도 이용 동의 전 — D-27) SDK를 요청하지 않는다.
import { useEffect, useState } from "react";
import { getNaverMapsLoader, type NaverMapsStatus } from "./naverSdk";

export function useNaverMaps(clientId: string | undefined, enabled: boolean) {
  const [status, setStatus] = useState<NaverMapsStatus>(clientId ? "loading" : "missing_client_id");
  const [maps, setMaps] = useState<typeof naver.maps | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const loader = getNaverMapsLoader();
    loader.load(clientId).then((result) => {
      if (!active) return;
      setStatus(result.status);
      setMaps(result.status === "ready" ? result.maps : null);
    });
    const unsubscribe = loader.onLateFailure((result) => {
      if (active) setStatus(result.status);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [clientId, enabled]);

  return { status, maps };
}
