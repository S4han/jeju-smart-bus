# TASK-004 — 비밀정보 관리 및 서버 프록시 골격

| 항목 | 내용 |
|---|---|
| Phase | 0 — 착수 전 검증 |
| 상태 | **B안 골격 구현 완료(2026-10-26)** — 확인자료 기록 장치는 D-12 L-1·L-4 결과 후 추가 |
| 관련 | NFR-003, NFR-006, PRIV-001~003, FR-005·017, R-03 |
| 결정 의존 | D-01, D-02, D-17 |

## 목적
버스 API 키를 브라우저에 노출하지 않고 호출할 서버 측 경로를 만들고, 좌표·키가 로그에 남지 않는 구조를 확립한다.

## 선행 조건
- [x] TASK-002 PRIV-001~003 통과(설계, 2026-10-26 — PRIV-002는 Hobby 전제)
- [x] TASK-003 Vercel 사용 가능 판정(2026-10-26: Hobby·비상업). 버스 API는 공공데이터포털 과금 구조 없음 — LINK 연계처 조건은 TASK-005에서 확인(골격 단계는 실호출 없음)
- [x] D-02 승인(2026-10-26): Vercel Functions(`api/`)
- [x] D-17 승인(2026-10-26): NAVER 지도 Client ID 외 모든 키는 서버 전용
- [x] D-22 승인(2026-10-26): `GET /api/arrivals?stopId=…` 허용, 좌표 필드는 거부
- [x] Vercel 로그 보존 기간 확인(2026-10-26): 런타임 로그 Hobby 1시간
- [ ] D-12 L-1·L-4 검토 결과(위치기반서비스사업 해당 시 확인자료 자동 기록 장치 필요 → 서버 설계 영향)
- [x] B안 승인(2026-10-26): `api/` 추가, `.env.example` 서버 변수 자리표시자. 의존성 추가·Vercel 설정 변경 없음

## 범위
- 포함: `api/` 서버 함수 골격(예: 도착정보 프록시 엔드포인트, 아직 실호출 없음), 서버 전용 환경변수 이름 정의(`.env.example`에 자리표시자), 공통 오류 응답 형식, 키 마스킹 유틸, 캐시 헤더 규칙
- 제외: 버스 API 실호출(TASK-005), 실제 키 등록(사용자가 Vercel 콘솔에서 직접 수행)

## 작업 항목
1. 서버 함수는 **정류장 ID 등 비위치 파라미터만** 받도록 입력 스키마 정의(D-01 A안 기준). 좌표 필드가 들어오면 무시·거부
2. 서버 전용 키 변수명 정의(예: `JEJU_BUS_API_KEY`) — `VITE_` 접두사 금지
3. 외부 오류를 정규화된 상태(`unavailable`, `quota_exhausted`, `invalid_response` 등)로 변환, 원문 URL·키를 응답·로그에 포함하지 않음
4. 캐시 헤더: 정류장 ID 단위 응답은 짧은 `s-maxage`(값은 GATE-04·06 후 결정), 오류 응답은 캐시 규칙 별도
5. 빌드 산출물(`dist/`)에 서버 키 문자열·변수명이 없는지 검사하는 스크립트 또는 체크 절차

## 수행 결과 (2026-10-26, B안)

| 구성 | 내용 |
|---|---|
| `api/arrivals.ts` | Vercel Function 진입점(Web 표준 `fetch` 핸들러). Vercel 문서 권고대로 로직은 `api/` 밖 `server/`에 둠 |
| `server/arrivals.ts` | `GET /api/arrivals?stopId=…`. 좌표성 파라미터 400(`location_not_accepted`, 값 미반영), 정류장 ID 검증 400(`invalid_stop_id`, 형식은 GATE-01 전이라 보수적 패턴), GET 외 405, 키 없음 503(`not_configured`), 키 있음 503(`upstream_not_implemented`) — **상류 실호출·임의 데이터 없음** |
| `server/request-guard.ts` | 좌표성 파라미터 목록(대소문자 무시), 정류장 ID 파서 |
| `server/http.ts` | 공통 응답 형식 `{status, code}`, 기본 `Cache-Control: no-store` |
| `server/secrets.ts` | 비밀값(원문·URL 인코딩) 및 `serviceKey`·`apiKey` 등 파라미터 마스킹 |
| `server/env.ts` | 서버 전용 `JEJU_BUS_API_KEY` 읽기 |
| `tsconfig.server.json` | `api`·`server` 타입 검사를 `tsc -b`에 포함 |
| `scripts/check-bundle-secrets.mjs` | `npm run build` 마지막 단계에서 `dist/`에 서버 변수 이름·값이 있으면 빌드 실패 |
| `tests/repo-guard.test.ts` | `api`·`server`에 `VITE_`·`console.` 사용 금지, `src`가 `server/`를 import 금지 |
| 미포함 | 확인자료 자동 기록 장치(D-12 결과 대기), 상류 오류 코드 정규화(TASK-005 실응답 후 TASK-019), 성공 응답 캐시 값(GATE-04 후) |

검증: `npm run build` 성공(클라이언트 번들 해시 변경 없음 `index-Dr_tebda.js`), `npm test` 21개 통과. 음성 확인 — 서버 코드 타입 오류 시 `tsc -b` 실패, `dist`에 변수 이름 삽입 시 번들 점검 실패(exit 1), 서버 코드에 `console.log` 추가 시 가드 테스트 실패.

## 수용 기준
- `dist/` 번들 검색 결과 서버 키 값·서버 전용 변수가 없다.
- 서버 함수 코드에 `console.log`로 요청 본문·외부 응답 원문·키를 출력하는 부분이 없다.
- 서버 함수가 좌표 입력을 처리하지 않는다(단위 테스트).
- `.env.example`에는 자리표시자만 있다.
- PoC 회귀 체크리스트 통과.

## 산출물
`api/` 골격, 오류 모델, `.env.example` 갱신, 비밀정보 점검 절차

## 보류 조건
D-02 미승인 또는 GATE-06에서 호스팅 불가 판정 시 보류.
