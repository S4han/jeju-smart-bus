// 기기별 배치 선택(TASK-023)
import { describe, expect, it } from "vitest";
import { mapLayoutFor } from "../src/ui/layout";

describe("mapLayoutFor", () => {
  it("세로 휴대폰은 아래 패널", () => {
    expect(mapLayoutFor(390, 844)).toBe("sheet");
    expect(mapLayoutFor(360, 640)).toBe("sheet");
  });
  it("태블릿·PC는 세로·가로 모두 왼쪽 패널", () => {
    expect(mapLayoutFor(768, 1024)).toBe("side");
    expect(mapLayoutFor(1024, 768)).toBe("side");
    expect(mapLayoutFor(1440, 900)).toBe("side");
  });
  it("가로로 눕힌 휴대폰은 왼쪽 패널, 아주 좁으면 아래 패널", () => {
    expect(mapLayoutFor(844, 390)).toBe("side");
    expect(mapLayoutFor(667, 375)).toBe("side");
    expect(mapLayoutFor(540, 360)).toBe("sheet");
  });
});
