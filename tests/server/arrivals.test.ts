// 도착정보 프록시 골격 (TASK-004, PRIV-001·002, D-22, NFR-003·004)
import { describe, expect, it } from "vitest";
import handler from "../../api/arrivals";

function get(query: string): Promise<Response> {
  return handler.fetch(new Request(`https://example.test/api/arrivals${query}`));
}

describe("GET /api/arrivals", () => {
  it("상류 호출 구현 전이므로 upstream_not_implemented이며 데이터를 만들지 않는다", async () => {
    const res = await get("?stopId=405001");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable", code: "upstream_not_implemented" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["lat", "LNG", "longitude", "x", "coords", "mapy"])("좌표성 파라미터 %s는 거부하고 값을 되돌려주지 않는다", async (name) => {
    const res = await get(`?stopId=405001&${name}=33.4996126`);
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ status: "invalid_input", code: "location_not_accepted" });
    expect(text).not.toContain("33.4996126");
  });

  it.each(["", "?stopId=", "?stopId=../etc", "?stopId=a&stopId=b", `?stopId=${"1".repeat(65)}`])(
    "잘못된 정류장 ID(%s)는 invalid_stop_id",
    async (query) => {
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ status: "invalid_input", code: "invalid_stop_id" });
    },
  );

  it("GET 외 메서드는 405와 Allow: GET", async () => {
    const res = await handler.fetch(
      new Request("https://example.test/api/arrivals?stopId=405001", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
  });
});
