// 비밀값 마스킹 (TASK-004, NFR-003)
import { describe, expect, it } from "vitest";
import { maskSecrets } from "../../server/secrets";

describe("maskSecrets", () => {
  it("비밀값 원문과 URL 인코딩 형태를 모두 가린다", () => {
    const key = "ab+c/d==";
    const text = `raw ${key} encoded ${encodeURIComponent(key)}`;
    expect(maskSecrets(text, [key])).toBe("raw *** encoded ***");
  });

  it("알려진 키 파라미터 값은 비밀값 목록에 없어도 가린다", () => {
    const url = "https://apis.example/x?serviceKey=SECRET123&nodeId=1&apiKey=k2";
    expect(maskSecrets(url, [])).toBe("https://apis.example/x?serviceKey=***&nodeId=1&apiKey=***");
  });

  it("빈 비밀값은 무시한다", () => {
    expect(maskSecrets("nothing here", [undefined, ""])).toBe("nothing here");
  });
});
