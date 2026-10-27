// 저장소 보안 가드 (TASK-001, NFR-003, AGENTS.md 규칙 7)
// VITE_ 접두사 변수는 클라이언트 번들에 포함되므로, 허용 목록 외 사용을 막는다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// D-17 승인: 도메인 제한 방식인 NAVER 지도 Client ID만 예외로 허용한다.
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

  // TASK-004: 서버 코드는 클라이언트 변수·로그 출력을 쓰지 않는다(AGENTS.md 규칙 6·7).
  it("api·server·shared는 VITE_ 변수와 console 출력을 쓰지 않는다", () => {
    const offenders = [...listFiles("api"), ...listFiles("server"), ...listFiles("shared")].filter((file) =>
      /\bVITE_[A-Z0-9_]+|\bconsole\s*\./.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("src·shared는 server 코드를 가져오지 않는다(서버 코드의 번들 포함 방지)", () => {
    const offenders = [...listFiles("src"), ...listFiles("shared")].filter((file) =>
      /from\s+["'][^"']*\bserver\//.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  // TASK-011·012·015: 출발지·목적지 좌표는 메모리 상태로만 둔다 — 저장소·URL·네트워크·로그로 내보내는 코드를 막는다(PRIV-001~003)
  it("src/origin·stops·destination·route는 저장소·URL·네트워크·console에 접근하지 않는다", () => {
    const forbidden = /\b(localStorage|sessionStorage|indexedDB|document\.cookie|history\.|location\.(href|search|hash|assign|replace)|fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|console\s*\.)/;
    const offenders = ["src/origin", "src/stops", "src/destination", "src/route"].flatMap(listFiles).filter((file) => forbidden.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  // TASK-018·D-16: 궤적 데이터가 없으므로 지도에 도형을 그리지 않는다(AC-020)
  // D-33(2026-10-27): 예외로 NaverMap.tsx의 정류장 순서 연결선(Polyline)만 허용 — "실제 도로 경로 아님" 표기와 함께
  it("src는 지도 선·도형 객체를 만들지 않는다(정류장 순서 연결선 1곳 예외)", () => {
    const offenders = listFiles("src").filter((file) => {
      const text = readFileSync(file, "utf8");
      if (/\b(Polygon|Rectangle|Circle|Ellipse|GroundOverlay)\b/.test(text)) return true;
      return /\bPolyline\b/.test(text) && !file.replace(/\\/g, "/").endsWith("src/map/NaverMap.tsx");
    });
    expect(offenders).toEqual([]);
  });

  it("정류장 순서 연결선을 그리면 '실제 도로 경로 아님'을 함께 표기한다(D-33)", () => {
    expect(readFileSync("src/App.tsx", "utf8")).toContain("실제 도로 경로 아님");
  });

  // FR-019(생성형 AI)은 MVP 제외 — AI SDK 의존성·호출 코드를 두지 않는다(AGENTS.md 규칙 3)
  it("생성형 AI SDK 의존성·호출이 없다", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /openai|anthropic|generative-ai|genai|langchain|cohere|mistral|ollama/i.test(d))).toEqual([]);
    const code = ["src", "server", "shared", "api"].flatMap(listFiles);
    expect(code.filter((f) => /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
