// 지도 이용 동의 상태 (TASK-021, D-27)
import { describe, expect, it } from "vitest";
import { CONSENT_KEY, clearConsent, readConsent, writeConsent } from "../../src/map/consent";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("지도 이용 동의 저장", () => {
  it("처음에는 unknown, 저장한 값을 다시 읽는다", () => {
    const s = memoryStorage();
    expect(readConsent(s)).toBe("unknown");
    writeConsent(s, "granted");
    expect(s.data.get(CONSENT_KEY)).toBe("granted");
    expect(readConsent(s)).toBe("granted");
    writeConsent(s, "declined");
    expect(readConsent(s)).toBe("declined");
  });

  it("철회하면 다시 unknown", () => {
    const s = memoryStorage();
    writeConsent(s, "granted");
    clearConsent(s);
    expect(readConsent(s)).toBe("unknown");
  });

  it("알 수 없는 값은 unknown — 동의로 간주하지 않는다", () => {
    const s = memoryStorage();
    s.setItem(CONSENT_KEY, "yes");
    expect(readConsent(s)).toBe("unknown");
  });

  it("저장소 접근이 막혀도 예외 없이 unknown(매번 묻기)", () => {
    expect(readConsent(throwing)).toBe("unknown");
    expect(() => writeConsent(throwing, "granted")).not.toThrow();
    expect(() => clearConsent(throwing)).not.toThrow();
    expect(readConsent(null)).toBe("unknown");
  });
});
