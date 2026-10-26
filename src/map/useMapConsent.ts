// 지도 이용 동의 상태 훅 (TASK-021, D-27)
import { useCallback, useState } from "react";
import { browserStorage, clearConsent, readConsent, writeConsent, type MapConsent } from "./consent";

export function useMapConsent() {
  const [state, setState] = useState<MapConsent>(() => readConsent(browserStorage()));

  const grant = useCallback(() => {
    writeConsent(browserStorage(), "granted");
    setState("granted");
  }, []);

  const decline = useCallback(() => {
    writeConsent(browserStorage(), "declined");
    setState("declined");
  }, []);

  // 이미 불러온 지도 SDK는 페이지를 다시 열어야 사라지므로 새로고침한다
  const revoke = useCallback(() => {
    clearConsent(browserStorage());
    window.location.reload();
  }, []);

  return { state, grant, decline, revoke };
}
