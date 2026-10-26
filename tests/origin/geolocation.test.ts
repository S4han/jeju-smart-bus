// 현재 위치 요청 (TASK-011, FR-001, AC-001)
import { describe, expect, it } from "vitest";
import { isValidCoordinates, requestCurrentPosition } from "../../src/origin/geolocation";

type Success = (p: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (e: { code: number }) => void;

function fakeGeo(run: (ok: Success, fail: Failure) => void) {
  const calls: PositionOptions[] = [];
  return {
    calls,
    getCurrentPosition: ((ok: Success, fail: Failure, options: PositionOptions) => {
      calls.push(options);
      run(ok, fail);
    }) as unknown as Geolocation["getCurrentPosition"],
  };
}

describe("requestCurrentPosition", () => {
  it("권한 허용 + 좌표 → ok와 좌표 (AC-001)", async () => {
    const geo = fakeGeo((ok) => ok({ coords: { latitude: 33.5, longitude: 126.5 } }));
    expect(await requestCurrentPosition(geo)).toEqual({ status: "ok", coordinates: { lat: 33.5, lng: 126.5 } });
    expect(geo.calls[0]).toMatchObject({ timeout: 10_000 });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ])("오류 코드 %i → %s (AC-001)", async (code, status) => {
    expect(await requestCurrentPosition(fakeGeo((_, fail) => fail({ code })))).toEqual({ status });
  });

  it("Geolocation 미지원 → unsupported", async () => {
    expect(await requestCurrentPosition(undefined)).toEqual({ status: "unsupported" });
  });

  it("좌표 값이 잘못되면 invalid — 출발지로 쓰지 않는다", async () => {
    const geo = fakeGeo((ok) => ok({ coords: { latitude: Number.NaN, longitude: 126.5 } }));
    expect(await requestCurrentPosition(geo)).toEqual({ status: "invalid" });
  });

  it("getCurrentPosition이 예외를 던지면 unavailable", async () => {
    const geo = fakeGeo(() => {
      throw new Error("blocked");
    });
    expect(await requestCurrentPosition(geo)).toEqual({ status: "unavailable" });
  });

  it("isValidCoordinates 범위 검사", () => {
    expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidCoordinates({ lat: 0, lng: -181 })).toBe(false);
    expect(isValidCoordinates({ lat: 33.5, lng: 126.5 })).toBe(true);
  });
});
