# CLAUDE.md — 제주 스마트 버스

@AGENTS.md

위 AGENTS.md의 공통 규칙이 이 문서보다 우선한다. 이 문서는 Claude Code 전용 보충 지침이다.

## 프로젝트 요약

- 제주 도민·관광객용 **모바일 웹** 버스 정보 서비스: 주변 정류장, 실시간 도착정보, 직행·최대 2회 환승 경로 추천.
- 경로 탐색·설명은 **규칙 기반**. 생성형 AI(FR-019)는 MVP 제외.
- 기준 문서: `docs/제주_스마트_버스_PRD_v1.0.md` (v1.0 확정, 2026-10-26)
- 진행 상황: `IMPLEMENTATION_PLAN.md`의 "진행 현황" 표와 `tasks/` 문서

## 기술 스택 (현재)

- React 19 + TypeScript 5.7 + Vite 6, `src/` 단일 컴포넌트 PoC
- 지도: NAVER Dynamic Map JS SDK v3 (`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=...`)
- 배포: Vercel (Git 연동, `vercel.json` 없음)
- 테스트: Vitest (`npm test`, `tests/`). 린트·서버 함수: 아직 없음 (서버 함수는 TASK-004)
- Node: `engines.node` `24.x` (Vercel 프로젝트 설정과 동일)

## 현재 코드 구조

```
index.html            # lang="ko", #root
src/main.tsx          # StrictMode로 <App/> 렌더
src/App.tsx           # NAVER 지도 SDK 동적 로드 → 제주시 중심 지도 + 마커 (PoC)
src/style.css         # 기본 스타일, #map 높이 min(70vh,650px)
src/vite-env.d.ts     # Vite 타입 참조
.env.example          # VITE_NAVER_MAP_CLIENT_ID 자리표시자
```

## 작업 시 주의

- `src/App.tsx`의 지도 로딩·인증 오류 메시지 흐름은 동작이 확인된 PoC다. 리팩터링(TASK-010) 전에는 수정하지 않는다.
- `VITE_NAVER_MAP_CLIENT_ID`는 NAVER 지도 SDK 구조상 브라우저에 전달된다(도메인 제한 방식). 이 예외의 공식 인정 여부는 사용자 결정 D-17이다. **그 외 모든 키는 서버 전용**이다.
- 실제 외부 API 호출은 사용자가 허용한 검증 TASK(TASK-005~008)에서만 한다. 그 외에는 검증된 픽스처로 테스트한다.
- 응답·로그 예시를 채팅이나 문서에 붙일 때 키·좌표 원문을 제거한다.
- `tests/repo-guard.test.ts`는 허용 목록 외 `VITE_` 변수 사용을 막는다. 새 클라이언트 환경변수가 필요하면 우회하지 말고 사용자 승인을 받는다.

## 작업 완료 보고 형식

1. 수행한 TASK와 관련 FR/AC
2. 변경 파일 목록
3. 검증 결과(실행한 명령과 결과, 실패 포함)
4. 남은 위험·미결정 사항과 사용자 승인이 필요한 항목
