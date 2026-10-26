# TASK-009 — 도메인 모델·데이터 접근 계층·결과 상태 모델

| 항목 | 내용 |
|---|---|
| Phase | 1 — 기반 |
| 상태 | **구현 완료(2026-10-26)** — 스냅샷 크기 실측(프로브 `SnapshotStats`)만 실호출 승인 대기 |
| 관련 | NFR-004, FR-005·010·014·016·017, US-007 |

## 목적
"검증되지 않은 정보를 만들지 않는다"는 원칙을 타입 수준에서 강제하는 도메인 모델과, 데이터 원천을 교체 가능한 접근 계층을 만든다.

## 선행 조건
- [x] TASK-001 완료(테스트 도구)
- [x] TASK-005·006 실응답 필드·가공 규칙 확인(D-24·D-26)

## 작업 항목
1. 도메인 타입: `Stop`(ID, 명칭, 좌표 **선택적**), `Route`, `RouteStopSequence`(방향·순서), `Arrival`(출처: `realtime` | `estimated`), `TimeComponent`(값 + 출처 + 검증 여부)
2. 결과 상태: `ok` / `empty` / `stale` / `inconsistent` / `unavailable` / `quota_exhausted` / `invalid_input` — UI가 원인별 안내를 할 수 있도록 구분
3. 데이터 접근 인터페이스: 정류장·노선 원천(정적 스냅샷 또는 API, D-01), 도착정보(서버 프록시). 테스트용 픽스처 구현
4. 외부 응답 → 도메인 변환기: 필수 필드 누락·형식 오류 시 추정값으로 채우지 않고 `invalid`/제외 처리
5. 가공 규칙(D-24·D-26): 정류장 `useYn=Y`, 노선 `useYn=Y`(`A` 제외), 사용 중 노선의 `StationRoute.useYn=Y` 행만, `stationCnt`·`updnDir` 미사용, 정류장 1개 이하 노선 제외, `routeTp=53` 포함, 문자열 `"null"`은 값 없음, 좌표 유효 범위는 제주 본섬+추자도, **경도·위도 뒤바뀐 정류장은 보정하지 않고 `coordinates: unavailable`**
6. 정적 스냅샷 생성 스크립트(D-01): `Station`·`Bus`·`StationRoute` 전체를 받아 위 규칙으로 가공한 JSON 생성, 크기 실측. 공개 배포 여부는 D-10 판정에 따름

## 수행 결과 (2026-10-26)

| 파일 | 내용 |
|---|---|
| `shared/domain.ts` | `Stop`(좌표 `null`=확인 불가), `Route`(`stopIds` 순서=운행 순서, D-21), `Arrival`(`vehicleId`·시간 `null` 가능, `source: "realtime"`), `TimeComponent`(출처 필수), `ResultStatus` 8종·`Result<T>` |
| `shared/bis-convert.ts` | `toCoordinates`(본섬+추자도만 유효, 뒤바뀐 좌표 미보정 — D-24·D-26), `toStop`, `toArrival`(필수값 없으면 제외, `arrvVhId=0`이면 차량·시간 없음), `buildSnapshot`(사용 중 정류장·노선·매핑만, 순번 불연속·미사용 정류장 참조·1개 이하 노선 제외, 사유별 집계) |
| `shared/sources.ts` | `SnapshotSource`·`ArrivalSource` 계약, 고정 데이터 구현(`createStaticSources` — 없으면 `empty`/`unavailable`) |
| `server/http.ts` | 응답 상태 타입을 `ResultStatus`로 통일 |
| `server/bis-probe.ts` | `op=SnapshotStats`: 스냅샷을 서버에서 만들어 **크기·통계만** 반환(데이터 미반환 — D-10 미결) |
| 테스트 | `tests/shared/` 23개(실응답 픽스처 사용) — 전체 53개 통과 |

`shared/`는 브라우저·서버 공용 순수 코드다. `server/`를 가져오지 않고 `console`·`VITE_`를 쓰지 않는다(`repo-guard`).

## 수용 기준
- 좌표 없는 정류장이 "좌표 있음" 타입으로 변환되지 않는다(테스트).
- 시간 값은 출처(실시간/추정)와 함께만 존재할 수 있다.
- 변환기는 필드 누락 픽스처에서 임의 값을 생성하지 않는다(테스트).
- 모든 결과 상태에 대응하는 테스트가 있다.

## 산출물
`src/domain/`, `src/data/` (경로는 구현 시 확정), 단위 테스트

## 보류 조건
TASK-005 미완료 시 실응답 변환기는 보류(인터페이스·상태 모델만 진행 가능).
