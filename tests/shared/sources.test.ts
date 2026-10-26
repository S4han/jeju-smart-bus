// 결과 상태·데이터 접근 계약 (TASK-009, FR-016·017)
import { describe, expect, it } from "vitest";
import { failure, ok, type ResultStatus } from "../../shared/domain";
import { createStaticSources } from "../../shared/sources";

const ALL_STATUSES: ResultStatus[] = [
  "ok",
  "empty",
  "stale",
  "inconsistent",
  "unavailable",
  "quota_exhausted",
  "rate_limited",
  "invalid_input",
];

describe("결과 상태", () => {
  it.each(ALL_STATUSES.filter((s) => s !== "ok"))("%s는 데이터 없이 상태와 사유만 가진다", (status) => {
    const result = failure<string[]>(status as Exclude<ResultStatus, "ok">, "reason");
    expect(result).toEqual({ status, reason: "reason" });
    expect("data" in result).toBe(false);
  });

  it("ok만 데이터를 가진다", () => {
    expect(ok([1])).toEqual({ status: "ok", data: [1] });
  });
});

describe("고정 데이터 소스", () => {
  it("스냅샷이 없으면 unavailable", async () => {
    expect(await createStaticSources(null).loadSnapshot()).toEqual({ status: "unavailable", reason: "snapshot_missing" });
  });

  it("등록되지 않은 정류장은 empty — 도착정보를 만들지 않는다", async () => {
    expect(await createStaticSources(null).getArrivals("405000153")).toEqual({ status: "empty" });
  });
});
