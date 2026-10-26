// 도착정보 프록시 (TASK-004·TASK-014, PRIV-001·002, D-22·D-25, NFR-003·004, AC-005)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import handler from "../../api/arrivals";
import { ARRIVALS_CACHE_CONTROL, createArrivalsHandler } from "../../server/arrivals";

function get(query: string): Promise<Response> {
  return handler.fetch(new Request(`https://example.test/api/arrivals${query}`));
}

describe("GET /api/arrivals", () => {
  it.each(["lat", "LNG", "longitude", "x", "coords", "mapy"])("좌표성 파라미터 %s는 거부하고 값을 되돌려주지 않는다", async (name) => {
    const res = await get(`?stopId=406000191&${name}=33.4996126`);
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ status: "invalid_input", code: "location_not_accepted" });
    expect(text).not.toContain("33.4996126");
  });

  it.each(["", "?stopId=", "?stopId=../etc", "?stopId=a&stopId=b", "?stopId=40600019", "?stopId=4060001911", "?stopId=40600019a"])(
    "잘못된 정류장 ID(%s)는 invalid_stop_id",
    async (query) => {
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ status: "invalid_input", code: "invalid_stop_id" });
    },
  );

  it("GET 외 메서드는 405와 Allow: GET", async () => {
    const res = await handler.fetch(
      new Request("https://example.test/api/arrivals?stopId=406000191", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
  });
});

// 실응답 픽스처(406000191) 행으로 만든 상류 XML
type Rec = Record<string, string>;
const { items, staleExampleItems } = JSON.parse(readFileSync("tests/fixtures/bis/bus-arrives-items.json", "utf8")) as {
  items: Rec[];
  staleExampleItems: Rec[];
};
const toXml = (rows: Rec[], code = "00") =>
  `<response><header><resultCode>${code}</resultCode></header><body><items>${rows
    .map((r) => `<item>${Object.entries(r).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</item>`)
    .join("")}</items></body></response>`;
const OBSERVED = Date.parse("2026-10-26T16:04:14+09:00");

function upstream(response: { status?: number; body?: string } | Error) {
  const urls: string[] = [];
  const impl = async (url: string) => {
    urls.push(url);
    if (response instanceof Error) throw response;
    return { ok: (response.status ?? 200) === 200, status: response.status ?? 200, text: async () => response.body ?? "" };
  };
  return { urls, handler: createArrivalsHandler(impl, () => OBSERVED) };
}
const call = (h: (r: Request) => Promise<Response>, stopId = "406000191") => h(new Request(`https://example.test/api/arrivals?stopId=${stopId}`));

describe("상류 연동 (TASK-014)", () => {
  it("정류장 ID만 상류로 보내고 키를 붙이지 않는다 (D-25)", async () => {
    const { urls, handler: h } = upstream({ body: toXml(items) });
    await call(h);
    expect(urls).toEqual(["http://busopen.jeju.go.kr/OpenAPI/service/bis/BusArrives?station=406000191"]);
  });

  it("행을 변환하고 조회 시점 데이터 나이를 붙인다, 15초 CDN 캐시", async () => {
    const { handler: h } = upstream({ body: toXml([...items, ...staleExampleItems]) });
    const res = await call(h);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(ARRIVALS_CACHE_CONTROL);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", stopId: "406000191", fetchedAt: "2026-10-26T07:04:14.000Z", invalidRows: 0 });
    expect(body.arrivals).toHaveLength(4);
    expect(body.arrivals[0]).toMatchObject({ routeId: "405320114", stopOrder: 24, vehicleId: "7983228", minutesToArrival: 25, ageSecondsAtFetch: 54 });
    expect(body.arrivals[3].ageSecondsAtFetch).toBeGreaterThan(365 * 24 * 3600); // 2025년 행은 나이로 드러난다
  });

  it("형식이 틀린 행은 버리고 개수만 센다", async () => {
    const { handler: h } = upstream({ body: toXml([items[0], { ...items[0], calcDate: "어제" }]) });
    const body = await (await call(h)).json();
    expect(body.arrivals).toHaveLength(1);
    expect(body.invalidRows).toBe(1);
  });

  it("0건은 빈 목록(ok) — 도착정보를 만들지 않는다", async () => {
    const { handler: h } = upstream({ body: readFileSync("tests/fixtures/bis/empty-response.xml", "utf8") });
    expect(await (await call(h)).json()).toMatchObject({ status: "ok", arrivals: [] });
  });

  it.each([
    [{ status: 500 }, 502, "upstream_http_error"],
    [{ body: toXml(items, "99") }, 502, "upstream_error"],
    [{ body: "<html>점검 중</html>" }, 502, "upstream_error"],
    [Object.assign(new Error("t"), { name: "TimeoutError" }), 504, "upstream_timeout"],
    [new TypeError("fetch failed"), 502, "upstream_unreachable"],
  ] as const)("상류 장애 %# → %i %s, no-store, 데이터 없음", async (response, httpStatus, code) => {
    const { handler: h } = upstream(response as never);
    const res = await call(h);
    expect(res.status).toBe(httpStatus);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "unavailable", code });
  });

  it("잘못된 요청은 상류를 호출하지 않는다", async () => {
    const { urls, handler: h } = upstream({ body: toXml(items) });
    await call(h, "../etc");
    await h(new Request("https://example.test/api/arrivals?stopId=406000191&lat=33.5"));
    expect(urls).toEqual([]);
  });
});
