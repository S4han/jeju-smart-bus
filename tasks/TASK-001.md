# TASK-001 — 개발 기준선 확립 및 PoC 보존 체계

| 항목 | 내용 |
|---|---|
| Phase | 0 — 착수 전 검증 |
| 상태 | 미착수 |
| 관련 | 규칙 10(PoC 보존), OBS-01·02·06, R-12·13 |
| 결정 의존 | D-08 |

## 목적
재현 가능한 빌드·테스트 기준선을 만들고, 이후 작업이 기존 지도 PoC를 깨뜨리지 않음을 확인할 수단을 마련한다.

## 선행 조건
- [ ] IMPLEMENTATION_PLAN.md 승인
- [ ] D-08(개발 의존성 도입 범위) 승인

## 범위
- 포함: lockfile 커밋, Node 버전 명시(`engines` 또는 `.nvmrc`), `*.tsbuildinfo` gitignore 추가, 승인된 테스트 도구(예: Vitest) 설치와 `test` 스크립트, PoC 회귀 체크리스트 작성
- 제외: `src/` 애플리케이션 동작 변경, Vercel 설정 변경, 환경변수 추가

## 작업 항목
1. `npm install`로 lockfile 생성·커밋 (의존성 버전 범위는 변경하지 않음)
2. Node 버전 고정 — Vercel 프로젝트의 Node 설정과 일치하는지 사용자 확인
3. `.gitignore`에 `*.tsbuildinfo` 추가
4. 승인된 테스트 도구 설치, `npm test` 스크립트 추가, 샘플 테스트 1개(순수 함수)로 동작 확인
5. 아래 **PoC 회귀 체크리스트**를 이 문서에 확정

## PoC 회귀 체크리스트 (이후 모든 지도 관련 변경에 적용)
- [ ] `npm run build` 성공
- [ ] `VITE_NAVER_MAP_CLIENT_ID` 미설정 시 "VITE_NAVER_MAP_CLIENT_ID 환경변수가 없습니다." 표시, 지도 SDK 요청 없음
- [ ] 정상 Client ID·허용 URL에서 제주시 중심(33.4996, 126.5312) zoom 11 지도와 마커 표시
- [ ] 지도 이동·확대/축소 동작
- [ ] SDK 로드 실패 시 "지도 SDK 로딩 실패…" 메시지 표시
- [ ] 상태 메시지가 `aria-live="polite"` 영역에 표시
- [ ] 모바일 폭(360px)에서 가로 스크롤 없음

## 수용 기준
- `npm run build`, `npm test`가 깨끗한 클론에서 통과한다.
- lockfile이 커밋되어 있고 Node 버전이 명시되어 있다.
- 애플리케이션 동작은 변경 전과 동일하다(회귀 체크리스트 통과).
- 비밀정보·`.env`가 커밋되지 않았다.

## 검증 방법
깨끗한 클론에서 `npm ci && npm run build && npm test`. 배포 미리보기에서 회귀 체크리스트 수동 확인.

## 산출물
lockfile, `package.json` 스크립트·engines, `.gitignore` 수정, 회귀 체크리스트

## 보류 조건
D-08 미승인 시 테스트 도구 도입 보류(lockfile·gitignore만 사용자 승인 후 진행).
