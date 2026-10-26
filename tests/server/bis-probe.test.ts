// TASK-005 임시 프로브 가드와 XML 요약
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/bis-probe";
import { extractItems, numericRange } from "../../server/xml-summary";

const XML = `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
<body><items><item><stationId>405001828</stationId><stationNm><![CDATA[신산머루]]></stationNm><localX>126.437467</localX><localY>33.450058</localY><useYn>Y</useYn></item>
<item><stationId>405001829</stationId><stationNm>무좌표</stationNm><localX></localX><localY>0</localY><useYn>N</useYn></item></items>
<numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

function get(query: string) {
  return handler.fetch(new Request(`https://example.test/api/bis-probe${query}`));
}

afterEach(() => {
  delete process.env.VERCEL_ENV;
  vi.unstubAllGlobals();
});

describe("bis-probe guards", () => {
  it("미리보기가 아니면 404이고 상류를 호출하지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.VERCEL_ENV = "production";
    expect((await get("?op=Station")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("허용되지 않은 오퍼레이션·파라미터는 거부한다", async () => {
    process.env.VERCEL_ENV = "preview";
    expect((await get("?op=BusPosition")).status).toBe(400);
    expect((await get("?op=BusArrives&station=1%26x%3D1")).status).toBe(400);
  });

  it("serviceKey를 보내지 않고(D-25) 항목 구조를 요약한다", async () => {
    process.env.VERCEL_ENV = "preview";
    const fetchMock = vi.fn(async () => new Response(XML, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await get("?op=Station&numOfRows=10&key=raw")).json();
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("serviceKey");
    expect(body.header.resultCode).toBe("00");
    expect(body.items).toMatchObject({ itemTag: "item", count: 2 });
    expect(body.items.numeric.localX).toMatchObject({ present: 1, missingOrEmpty: 1 });
    expect(body.items.categories.useYn).toEqual({ Y: 1, N: 1 });
  });
});

describe("xml-summary", () => {
  it("CDATA와 빈 값·0을 구분한다", () => {
    const { records } = extractItems(XML);
    expect(records[0].stationNm).toBe("신산머루");
    expect(numericRange(records, "localY")).toMatchObject({ present: 2, zero: 1, min: 0, max: 33.450058 });
  });
});

describe("coordinateQuality", () => {
  it("뒤바뀐 좌표·범위 밖·누락을 구분한다", async () => {
    const { coordinateQuality } = await import("../../server/xml-summary");
    const q = coordinateQuality(
      [
        { stationId: "a", localX: "126.5", localY: "33.5" },
        { stationId: "b", localX: "33.5", localY: "126.5" },
        { stationId: "c", localX: "127.5", localY: "37.5" },
        { stationId: "d", localX: "", localY: "33.5" },
      ],
      "stationId",
    );
    expect(q).toMatchObject({ valid: 1, swapped: 1, outOfRange: 1, missing: 1, swappedExamples: ["b"], outOfRangeExamples: ["c"] });
  });
});
