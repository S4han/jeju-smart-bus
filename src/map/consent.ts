// 지도(NAVER Maps) 이용 동의 상태 (TASK-021, D-27, Maps 약관 제7조 ⑤)
// 동의 여부는 이 브라우저에만 기억한다. 서버로 보내거나 저장하지 않는다.
// 저장소에 접근할 수 없으면(사생활 보호 모드 등) 기억하지 못하고 매번 묻는다.

export type MapConsent = "unknown" | "granted" | "declined";

// 고지 문구가 바뀌면 버전을 올려 다시 묻는다
export const CONSENT_KEY = "map-consent:v1";

type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readConsent(storage: ConsentStorage | null): MapConsent {
  try {
    const value = storage?.getItem(CONSENT_KEY);
    return value === "granted" || value === "declined" ? value : "unknown";
  } catch {
    return "unknown";
  }
}

export function writeConsent(storage: ConsentStorage | null, value: Exclude<MapConsent, "unknown">): void {
  try {
    storage?.setItem(CONSENT_KEY, value);
  } catch {
    // 기억하지 못해도 이번 화면에서는 선택을 따른다
  }
}

export function clearConsent(storage: ConsentStorage | null): void {
  try {
    storage?.removeItem(CONSENT_KEY);
  } catch {
    // 지울 수 없으면 다음 접속 때 다시 묻지 못할 수 있으나 이번 화면은 미동의로 돌아간다
  }
}

export function browserStorage(): ConsentStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
