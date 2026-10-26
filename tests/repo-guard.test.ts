// 저장소 보안 가드 (TASK-001, NFR-003, AGENTS.md 규칙 7)
// VITE_ 접두사 변수는 클라이언트 번들에 포함되므로, 허용 목록 외 사용을 막는다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// D-17 결정 전까지 기존 PoC가 사용하는 지도 Client ID만 허용한다.
const ALLOWED_CLIENT_ENV = ["VITE_NAVER_MAP_CLIENT_ID"];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe("repo guard", () => {
  it("src는 허용된 VITE_ 환경변수만 참조한다", () => {
    const used = new Set<string>();
    for (const file of listFiles("src")) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bVITE_[A-Z0-9_]+/g)) used.add(m[0]);
    }
    expect([...used].filter((name) => !ALLOWED_CLIENT_ENV.includes(name))).toEqual([]);
  });

  it(".env.example에는 자리표시자 값만 있다", () => {
    const entries = readFileSync(".env.example", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("="));
    for (const [, value = ""] of entries) {
      expect(value).toMatch(/^(your_[a-z0-9_]+_here)?$/);
    }
  });
});
