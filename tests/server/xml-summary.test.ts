// 제주 BIS XML 응답 읽기 (TASK-005에서 실응답으로 확인한 구조)
import { describe, expect, it } from "vitest";
import { extractItems, firstTag } from "../../server/xml-summary";

const XML = `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
<body><items><item><stationId>405001828</stationId><stationNm><![CDATA[신산머루]]></stationNm><localX>126.437467</localX><localY>33.450058</localY><useYn>Y</useYn></item>
<item><stationId>405001829</stationId><stationNm>무좌표</stationNm><localX></localX><localY>0</localY><useYn>N</useYn></item></items>
<numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

describe("xml-summary", () => {
  it("결과 코드를 읽는다", () => {
    expect(firstTag(XML, "resultCode")).toBe("00");
    expect(firstTag("<html>점검</html>", "resultCode")).toBeUndefined();
  });

  it("items 아래 행을 문자열 레코드로, CDATA를 풀고 빈 값·0을 그대로 둔다", () => {
    const { itemTag, records } = extractItems(XML);
    expect(itemTag).toBe("item");
    expect(records).toHaveLength(2);
    expect(records[0].stationNm).toBe("신산머루");
    expect(records[1]).toMatchObject({ localX: "", localY: "0" });
  });

  it("items가 없거나 비어 있으면 0건", () => {
    expect(extractItems("<response/>").records).toEqual([]);
    expect(extractItems("<items></items>").records).toEqual([]);
  });
});
