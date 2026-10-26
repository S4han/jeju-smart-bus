// 도착정보 요청 (TASK-014, D-22) — 정류장 ID만 보내고 응답 형식을 검사한다
import { describe, expect, it } from "vitest";
import { QUOTA_PAUSE_MS, RETRY_DELAYS_MS, createHttpArrivalSource } from "../../src/data/httpArrivalSource";

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

describe("재시도·한도 소진 (TASK-019, FR-017)", () => {
  function sequence(responses: Array<{ status: number; body: unknown }>) {
    let now = 0;
    const urls: string[] = [];
    const sleeps: number[] = [];
    const impl = async (url: string) => {
      const r = responses[Math.min(urls.length, responses.length - 1)];
      urls.push(url);
      return { ok: r.status === 200, status: r.status, headers: { get: () => null }, json: async () => r.body };
    };
    const source = createHttpArrivalSource(impl, () => now, async (ms) => {
      sleeps.push(ms);
      now += ms;
    });
    return { urls, sleeps, source, advance: (ms: number) => (now += ms) };
  }

  it("rate_limited → 1초·2초 백오프 후 성공하면 결과", async () => {
    const s = sequence([{ status: 429, body: { status: "rate_limited" } }, { status: 429, body: {} }, { status: 200, body: PAYLOAD }]);
    expect((await s.source.getArrivals("406000191")).status).toBe("ok");
    expect(s.sleeps).toEqual(RETRY_DELAYS_MS);
  });

  it("재시도 상한: 3번 모두 실패하면 rate_limited로 끝(무한 재시도 없음)", async () => {
    const s = sequence([{ status: 429, body: { status: "rate_limited" } }]);
    expect((await s.source.getArrivals("406000191")).status).toBe("rate_limited");
    expect(s.urls).toHaveLength(3);
  });

  it("quota_exhausted → 재시도 없음, 10분 동안 요청 자체를 보내지 않음", async () => {
    const s = sequence([{ status: 503, body: { status: "quota_exhausted" } }, { status: 200, body: PAYLOAD }]);
    expect((await s.source.getArrivals("406000191")).status).toBe("quota_exhausted");
    expect((await s.source.getArrivals("405000153")).status).toBe("quota_exhausted");
    expect(s.urls).toHaveLength(1);
    s.advance(QUOTA_PAUSE_MS);
    expect((await s.source.getArrivals("406000191")).status).toBe("ok");
  });

  it("상류 오류(502)는 재시도하지 않는다, 시간 초과(504)는 재시도", async () => {
    const a = sequence([{ status: 502, body: { status: "unavailable" } }]);
    expect((await a.source.getArrivals("406000191")).status).toBe("unavailable");
    expect(a.urls).toHaveLength(1);
    const b = sequence([{ status: 504, body: { status: "unavailable" } }, { status: 200, body: PAYLOAD }]);
    expect((await b.source.getArrivals("406000191")).status).toBe("ok");
  });
});

describe("노선 단위 예측 요청 (D-30)", () => {
  const ROUTE_PAYLOAD = { ...PAYLOAD, stopId: "405002036", routeId: "405131201", arrivals: [{ ...PAYLOAD.arrivals[0], routeId: "405131201", stopId: "405002036" }] };

  it("노선 ID와 정류장 ID만 쿼리로 보낸다", async () => {
    const { urls, impl } = fake(200, ROUTE_PAYLOAD);
    const r = await createHttpArrivalSource(impl).getRoutePredictions("405131201", "405002036");
    expect(r.status).toBe("ok");
    expect(urls).toEqual(["/api/arrivals?stopId=405002036&routeId=405131201"]);
  });

  it("다른 노선 응답·정류장 ID 없는 행은 inconsistent", async () => {
    expect((await createHttpArrivalSource(fake(200, { ...ROUTE_PAYLOAD, routeId: "405131202" }).impl).getRoutePredictions("405131201", "405002036")).status).toBe("inconsistent");
    const noStop = { ...ROUTE_PAYLOAD, arrivals: [{ ...PAYLOAD.arrivals[0], routeId: "405131201" }] };
    expect((await createHttpArrivalSource(fake(200, noStop).impl).getRoutePredictions("405131201", "405002036")).status).toBe("inconsistent");
  });
});
