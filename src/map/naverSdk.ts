// NAVER Dynamic Map SDK 로더 (TASK-010, FR-004·FR-020 기반, D-17)
// 스크립트는 한 번만 삽입한다(StrictMode 이중 실행·여러 컴포넌트에서 재사용 — OBS-04).
// Client ID만 브라우저에 전달된다(D-17). 사용자 좌표는 이 로더가 다루지 않는다.

const SDK_URL = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=";

export type NaverMapsStatus = "loading" | "ready" | "missing_client_id" | "init_failed" | "load_failed";

// 기존 PoC 문구를 그대로 쓴다(회귀 체크리스트, TASK-001)
export const STATUS_MESSAGES: Record<NaverMapsStatus, string> = {
  loading: "지도 SDK 로딩 중...",
  ready: "제주 지도 표시 완료 · 이동 및 확대/축소를 테스트하세요.",
  missing_client_id: "VITE_NAVER_MAP_CLIENT_ID 환경변수가 없습니다.",
  init_failed: "지도 SDK 초기화 실패: 인증 정보와 허용 URL을 확인하세요.",
  load_failed: "지도 SDK 로딩 실패: Client ID 및 Web 서비스 URL을 확인하세요.",
};

type MapsNamespace = typeof naver.maps;

declare global {
  interface Window {
    naver?: { maps?: MapsNamespace };
    // NAVER SDK가 인증 실패 시 호출하는 전역 콜백
    navermap_authFailure?: () => void;
  }
}

export type LoadResult = { status: "ready"; maps: MapsNamespace } | { status: Exclude<NaverMapsStatus, "ready" | "loading"> };

// 테스트에서 가짜 window·document를 주입할 수 있게 의존성을 받는다
export interface LoaderEnv {
  window: Pick<Window, "naver" | "navermap_authFailure">;
  createScript(src: string, onload: () => void, onerror: () => void): void;
}

export function createNaverMapsLoader(env: LoaderEnv) {
  let pending: Promise<LoadResult> | null = null;
  const listeners = new Set<(result: LoadResult) => void>();

  return {
    load(clientId: string | undefined): Promise<LoadResult> {
      if (!clientId) return Promise.resolve({ status: "missing_client_id" });
      if (pending) return pending;
      pending = new Promise<LoadResult>((resolve) => {
        env.window.navermap_authFailure = () => {
          const failed: LoadResult = { status: "init_failed" };
          listeners.forEach((listen) => listen(failed));
        };
        env.createScript(
          SDK_URL + encodeURIComponent(clientId),
          () => {
            const maps = env.window.naver?.maps;
            resolve(maps ? { status: "ready", maps } : { status: "init_failed" });
          },
          () => resolve({ status: "load_failed" }),
        );
      });
      return pending;
    },
    // 로드 이후 인증 실패처럼 늦게 오는 실패를 구독한다
    onLateFailure(listen: (result: LoadResult) => void): () => void {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
  };
}

let browserLoader: ReturnType<typeof createNaverMapsLoader> | null = null;

// 브라우저 전역에 하나만 둔다. 처음 쓸 때 만든다(모듈 로드 시 window에 접근하지 않음)
export function getNaverMapsLoader() {
  browserLoader ??= createNaverMapsLoader({
    window,
    createScript(src, onload, onerror) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => onload();
      script.onerror = () => onerror();
      document.head.appendChild(script);
    },
  });
  return browserLoader;
}
