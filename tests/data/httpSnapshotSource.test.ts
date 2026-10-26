// 정적 스냅샷 로드·형식 검사 (D-01·D-10, NFR-004)
import { describe, expect, it } from "vitest";
import { createHttpSnapshotSource, isTransitSnapshot } from "../../src/data/httpSnapshotSource";
import { formatSnapshotDate } from "../../src/data/DataAttribution";

const SNAPSHOT = {
  schemaVersion: 1,
  generatedAt: "2026-10-26T00:00:00.000Z",
  sourceUpdatedAt: null,
  stops: [
    { id: "T1", name: "가상 정류장", coordinates: { lat: 33.5, lng: 126.5 } },
    { id: "T2", name: "좌표 없음", coordinates: null },
  ],
  routes: [{ id: "R1", name: "가상 노선", subName: null, type: null, stopIds: ["T1", "T2"] }],
};

function fakeFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
  const urls: string[] = [];
  const impl = async (url: string) => {
    urls.push(url);
    const r = responses[Math.min(urls.length - 1, responses.length - 1)];
    if (r instanceof Error) throw r;
    return { ok: r.status === 200, status: r.status, json: async () => r.body };
  };
  return { urls, impl };
}

describe("createHttpSnapshotSource", () => {
  it("정상 파일 → ok, 고정 경로 1회만 요청(위치와 무관)", async () => {
    const { urls, impl } = fakeFetch([{ status: 200, body: SNAPSHOT }]);
    const source = createHttpSnapshotSource("/data/transit-snapshot.v1.json", impl);
    expect(await source.loadSnapshot()).toEqual({ status: "ok", data: SNAPSHOT });
    await source.loadSnapshot();
    expect(urls).toEqual(["/data/transit-snapshot.v1.json"]);
  });

  it("파일 없음(404)·네트워크 오류 → unavailable, 다음 호출에서 다시 시도", async () => {
    const { urls, impl } = fakeFetch([{ status: 404 }, new Error("offline"), { status: 200, body: SNAPSHOT }]);
    const source = createHttpSnapshotSource("/s.json", impl);
    expect(await source.loadSnapshot()).toEqual({ status: "unavailable", reason: "http_404" });
    expect(await source.loadSnapshot()).toEqual({ status: "unavailable", reason: "network_or_parse" });
    expect((await source.loadSnapshot()).status).toBe("ok");
    expect(urls).toHaveLength(3);
  });

  it("형식이 다르면 inconsistent — 일부라도 쓰지 않는다", async () => {
    const bad = { ...SNAPSHOT, stops: [{ id: "T1", name: "x", coordinates: { lat: "33.5", lng: 126.5 } }] };
    const { impl } = fakeFetch([{ status: 200, body: bad }]);
    expect(await createHttpSnapshotSource("/s.json", impl).loadSnapshot()).toEqual({ status: "inconsistent", reason: "schema_mismatch" });
  });

  it("isTransitSnapshot: 버전·필드 검사", () => {
    expect(isTransitSnapshot(SNAPSHOT)).toBe(true);
    expect(isTransitSnapshot({ ...SNAPSHOT, schemaVersion: 2 })).toBe(false);
    expect(isTransitSnapshot({ ...SNAPSHOT, routes: [{ id: "R1", name: "n", stopIds: [1] }] })).toBe(false);
    expect(isTransitSnapshot(null)).toBe(false);
  });
});

describe("출처 표시 기준 시각", () => {
  it("한국 시간으로 표시, 잘못된 값은 표시하지 않음", () => {
    expect(formatSnapshotDate("2026-10-26T00:00:00.000Z")).toContain("2026");
    expect(formatSnapshotDate("2026-10-26T00:00:00.000Z")).toContain("9:00");
    expect(formatSnapshotDate("not-a-date")).toBeNull();
  });
});
