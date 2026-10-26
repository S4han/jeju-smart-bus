// NAVER 지도 SDK 로더·마커 입력 (TASK-010, OBS-04, AC-004·AC-020, D-17)
import { describe, expect, it } from "vitest";
import { toMarkerInputs } from "../../src/map/markers";
import { createNaverMapsLoader, STATUS_MESSAGES, type LoaderEnv } from "../../src/map/naverSdk";

function fakeEnv() {
  const scripts: Array<{ src: string; onload: (() => void) | null; onerror: (() => void) | null }> = [];
  const win: LoaderEnv["window"] = {};
  const env: LoaderEnv = {
    window: win,
    createScript(src, onload, onerror) {
      scripts.push({ src, onload, onerror });
    },
  };
  return { env, win, scripts };
}

describe("NAVER 지도 SDK 로더", () => {
  it("Client ID가 없으면 스크립트를 넣지 않는다", async () => {
    const { env, scripts } = fakeEnv();
    expect(await createNaverMapsLoader(env).load(undefined)).toEqual({ status: "missing_client_id" });
    expect(scripts).toHaveLength(0);
  });

  it("여러 번 불러도 스크립트는 한 번만 넣는다(StrictMode 이중 실행 대응)", async () => {
    const { env, win, scripts } = fakeEnv();
    const loader = createNaverMapsLoader(env);
    const first = loader.load("abc");
    const second = loader.load("abc");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=abc");
    win.naver = { maps: {} as typeof naver.maps };
    scripts[0].onload?.();
    expect((await first).status).toBe("ready");
    expect(await second).toBe(await first);
  });

  it("로드됐지만 SDK 객체가 없으면 초기화 실패, 로드 오류면 로딩 실패", async () => {
    const a = fakeEnv();
    const pa = createNaverMapsLoader(a.env).load("abc");
    a.scripts[0].onload?.();
    expect(await pa).toEqual({ status: "init_failed" });

    const b = fakeEnv();
    const pb = createNaverMapsLoader(b.env).load("abc");
    b.scripts[0].onerror?.();
    expect(await pb).toEqual({ status: "load_failed" });
  });

  it("SDK 인증 실패 콜백은 늦은 실패로 알린다", async () => {
    const { env, win } = fakeEnv();
    const loader = createNaverMapsLoader(env);
    const seen: string[] = [];
    loader.onLateFailure((r) => seen.push(r.status));
    loader.load("abc");
    win.navermap_authFailure?.();
    expect(seen).toEqual(["init_failed"]);
  });

  it("상태 문구는 PoC 문구와 같다(회귀 체크리스트)", () => {
    expect(STATUS_MESSAGES).toEqual({
      loading: "지도 SDK 로딩 중...",
      ready: "제주 지도 표시 완료 · 이동 및 확대/축소를 테스트하세요.",
      missing_client_id: "VITE_NAVER_MAP_CLIENT_ID 환경변수가 없습니다.",
      init_failed: "지도 SDK 초기화 실패: 인증 정보와 허용 URL을 확인하세요.",
      load_failed: "지도 SDK 로딩 실패: Client ID 및 Web 서비스 URL을 확인하세요.",
    });
  });
});

describe("마커 입력", () => {
  it("좌표가 확인된 항목만 마커가 된다", () => {
    expect(
      toMarkerInputs([
        { id: "405000153", title: "제주버스터미널", coordinates: { lat: 33.499974, lng: 126.514 } },
        { id: "406002082", title: "색달동(야크마을)", coordinates: null },
      ]),
    ).toEqual([{ id: "405000153", title: "제주버스터미널", position: { lat: 33.499974, lng: 126.514 } }]);
  });
});
