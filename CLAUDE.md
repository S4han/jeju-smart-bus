# CLAUDE.md — 제주 스마트 버스

@AGENTS.md

위 AGENTS.md의 공통 규칙이 이 문서보다 우선한다. 이 문서는 Claude Code 전용 보충 지침이다.

## 프로젝트 요약

- 제주 도민·관광객용 **모바일 웹** 버스 정보 서비스: 주변 정류장, 실시간 도착정보, 직행·최대 2회 환승 경로 추천.
- 경로 탐색·설명은 **규칙 기반**. 생성형 AI(FR-019)는 MVP 제외.
- 기준 문서: `docs/제주_스마트_버스_PRD_v1.0.md` (v1.0 확정, 2026-10-26)
- 진행 상황: `IMPLEMENTATION_PLAN.md`의 "진행 현황" 표와 `tasks/` 문서

## 기술 스택 (현재)

- React 19 + TypeScript 5.7 + Vite 6. 화면은 아직 PoC(지도 모듈은 `src/map/`으로 분리됨)
- 지도: NAVER Dynamic Map JS SDK v3 (`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=...`)
- 배포: Vercel (Git 연동, `vercel.json` 없음)
- 테스트: Vitest (`npm test`, `tests/`). 린트: 없음
- 서버 함수: Vercel Functions. 진입점은 `api/`(파일마다 함수 1개가 생기므로 최소화), 로직은 `server/`. 의존성 없이 Web 표준 `fetch` 핸들러 사용. 상대 import는 `.js` 확장자로 작성(ESM 런타임)
- Node: `engines.node` `24.x` (Vercel 프로젝트 설정과 동일)

## 현재 코드 구조

```
index.html            # lang="ko", #root
src/main.tsx          # StrictMode로 <App/> 렌더
src/App.tsx           # PoC 화면: 제주시 중심 지도 + 마커, 상태 문구
src/map/              # NAVER 지도 SDK 로더(1회 삽입·상태·인증 실패), 지도 컴포넌트, 마커 입력(좌표 확인된 항목만),
                      # 지도 이용 동의(consent.ts·MapConsentPanel — 동의 전 SDK 요청 금지, D-27)
src/style.css         # 기본 스타일, #map 높이 min(70vh,650px)
src/vite-env.d.ts     # Vite 타입 참조
api/arrivals.ts       # Vercel Function 진입점 → server/arrivals.ts
server/               # 서버 전용 로직(좌표 거부, 응답 형식, 마스킹, env) — src에서 import 금지
shared/               # 브라우저·서버 공용 순수 코드: 도메인 타입(domain.ts), BIS 변환·스냅샷 가공(bis-convert.ts), 데이터 소스 계약(sources.ts)
api/bis-probe.ts      # 임시 BIS 검증 함수(미리보기 전용) — 검증 TASK 종료 후 삭제
scripts/check-bundle-secrets.mjs  # build 마지막 단계: dist에 서버 비밀정보 있으면 실패
.env.example          # VITE_NAVER_MAP_CLIENT_ID 자리표시자 (버스 API는 키 없이 호출 — D-25)
```

## 작업 시 주의

- 지도 상태 문구는 `src/map/naverSdk.ts`의 `STATUS_MESSAGES`가 PoC 문구 그대로다(테스트로 고정). 바꾸려면 사용자 승인
- `VITE_NAVER_MAP_CLIENT_ID`는 NAVER 지도 SDK 구조상 브라우저에 전달된다(도메인 제한 방식). D-17로 규칙 7의 예외가 승인되었다(2026-10-26). **그 외 모든 키는 서버 전용**이다.
- 실제 외부 API 호출은 사용자가 허용한 검증 TASK(TASK-005~008)에서만 한다. 그 외에는 검증된 픽스처로 테스트한다.
- 응답·로그 예시를 채팅이나 문서에 붙일 때 키·좌표 원문을 제거한다.
- `tests/repo-guard.test.ts`는 허용 목록 외 `VITE_` 변수 사용을 막는다. 새 클라이언트 환경변수가 필요하면 우회하지 말고 사용자 승인을 받는다.

## 작업 완료 보고 형식

1. 수행한 TASK와 관련 FR/AC
2. 변경 파일 목록
3. 검증 결과(실행한 명령과 결과, 실패 포함)
4. 남은 위험·미결정 사항과 사용자 승인이 필요한 항목
