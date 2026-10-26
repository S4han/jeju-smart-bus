// 도착정보 요청 (TASK-014, D-22) — 정류장 ID만 보내고 응답 형식을 검사한다
import { describe, expect, it } from "vitest";
import { createHttpArrivalSource } from "../../src/data/httpArrivalSource";

const PAYLOAD = {
  status: "ok",
  stopId: "406000191",
  fetchedAt: "2026-10-26T07:04:14.000Z",
  invalidRows: 0,
  arrivals: [
    { routeId: "405320114", stopOrder: 24, vehicleId: "7983228", minutesToArrival: 25, stopsAway: 21, calculatedAt: "2026-10-26T07:03:20.000Z", source: "realtime", ageSecondsAtFetch: 54 },
  ],
};

function fake(status: number, body: unknown, headers: Record<string, string> = {}) {
  const urls: string[] = [];
  const impl = async (url: string) => {
    urls.push(url);
    return { ok: status === 200, status, headers: { get: (n: string) => headers[n] ?? null }, json: async () => body };
  };
  return { urls, impl };
}

describe("createHttpArrivalSource", () => {
  it("정류장 ID만 쿼리로 보내고, Age 헤더와 받은 시점을 함께 돌려준다", async () => {
    const { urls, impl } = fake(200, PAYLOAD, { Age: "7" });
    const result = await createHttpArrivalSource(impl, () => 1234).getArrivals("406000191");
    expect(urls).toEqual(["/api/arrivals?stopId=406000191"]);
    expect(result).toEqual({ status: "ok", data: { payload: PAYLOAD, cacheAgeSeconds: 7, receivedAtMs: 1234 } });
  });

  it("다른 정류장 응답·형식 오류는 inconsistent", async () => {
    expect((await createHttpArrivalSource(fake(200, { ...PAYLOAD, stopId: "406000192" }).impl).getArrivals("406000191")).status).toBe("inconsistent");
    const bad = { ...PAYLOAD, arrivals: [{ ...PAYLOAD.arrivals[0], ageSecondsAtFetch: "54" }] };
    expect((await createHttpArrivalSource(fake(200, bad).impl).getArrivals("406000191")).status).toBe("inconsistent");
  });

  it("서버 오류 → unavailable, 400 → invalid_input", async () => {
    expect(await createHttpArrivalSource(fake(504, { status: "unavailable" }).impl).getArrivals("406000191")).toEqual({ status: "unavailable", reason: "http_504" });
    expect((await createHttpArrivalSource(fake(400, {}).impl).getArrivals("406000191")).status).toBe("invalid_input");
  });
});
