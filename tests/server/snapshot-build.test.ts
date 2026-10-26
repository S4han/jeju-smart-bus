// 빌드 시 스냅샷 생성 (TASK-009 후속, D-10·D-25·D-26)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BIS_BASE_URL, fetchSnapshot } from "../../server/snapshot-build";

type Rec = Record<string, string>;
const fixture = (name: string): Rec[] => JSON.parse(readFileSync(`tests/fixtures/bis/${name}`, "utf8"));
const toXml = (items: Rec[], code = "00") =>
  `<response><header><resultCode>${code}</resultCode></header><body><items>${items
    .map((r) => `<item>${Object.entries(r).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</item>`)
    .join("")}</items></body></response>`;

// 실응답 픽스처(정류장·노선·매핑)를 묶어 노선 1개가 성립하도록 맞춘 응답
const STATIONS = fixture("station-items.json");
const ROUTE_ROWS = fixture("station-route-items.json").filter((r) => r.routeId === "405320114");
const STOPS_FOR_ROUTE = ROUTE_ROWS.map((r, i) => ({ ...STATIONS[2], stationId: r.stationId, stationNm: `정류장${i}` }));
const BUS = [{ ...fixture("bus-items.json")[0], routeId: "405320114", useYn: "Y" }];

function fakeFetch(bodies: Record<string, string>, status = 200) {
  const urls: string[] = [];
  const impl = async (url: string) => {
    urls.push(url);
    return { ok: status === 200, status, text: async () => bodies[url.slice(BIS_BASE_URL.length)] ?? "" };
  };
  return { urls, impl };
}

const NORMAL = { Station: toXml([...STATIONS, ...STOPS_FOR_ROUTE]), Bus: toXml(BUS), StationRoute: toXml(ROUTE_ROWS) };

describe("fetchSnapshot", () => {
  it("Station·Bus·StationRoute 3회 호출, 키 파라미터 없이 가공 결과 반환", async () => {
    const { urls, impl } = fakeFetch(NORMAL);
    const { snapshot, stats } = await fetchSnapshot(impl, () => new Date("2026-10-26T00:00:00Z"));
    expect(urls).toEqual(["Station", "Bus", "StationRoute"].map((op) => BIS_BASE_URL + op));
    expect(urls.some((u) => /serviceKey|\?/.test(u))).toBe(false);
    expect(snapshot.generatedAt).toBe("2026-10-26T00:00:00.000Z");
    expect(stats.routes.included).toBe(1);
    expect(snapshot.stops.every((s) => s.id !== "405000151")).toBe(true); // useYn N 제외
  });

  it("HTTP 오류·resultCode 비정상·0건이면 실패(빈 스냅샷 배포 금지)", async () => {
    await expect(fetchSnapshot(fakeFetch(NORMAL, 503).impl)).rejects.toThrow("HTTP 503");
    await expect(fetchSnapshot(fakeFetch({ ...NORMAL, Bus: toXml(BUS, "99") }).impl)).rejects.toThrow("resultCode 99");
    await expect(fetchSnapshot(fakeFetch({ ...NORMAL, StationRoute: toXml([]) }).impl)).rejects.toThrow("0건");
  });

  it("가공 후 노선이 0개면 실패", async () => {
    const { impl } = fakeFetch({ ...NORMAL, Bus: toXml([{ ...BUS[0], useYn: "N" }]) });
    await expect(fetchSnapshot(impl)).rejects.toThrow("노선 0");
  });
});
