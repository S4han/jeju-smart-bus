# TASK-009 — 도메인 모델·데이터 접근 계층·결과 상태 모델

| 항목 | 내용 |
|---|---|
| Phase | 1 — 기반 |
| 상태 | **완료(2026-10-26)** — 스냅샷 크기 실측 포함. 스냅샷 배포 방식은 D-10 이후 |
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

### 스냅샷 실측 (2026-10-26 16:19 KST, 사용자 승인, 상류 호출 3회 — 누적 22회)

| 항목 | 값 |
|---|---|
| 포함 정류장 | 4,352 (미사용 제외 464, 형식 오류 0) — 그중 좌표 확인 불가 1(D-24) |
| 포함 노선 | 991 (미사용·`A` 제외 2,500, 정류장 1개 이하 제외 3, 매핑 없음·순번 불연속·미사용 정류장 참조 0) |
| 노선-정류장 행 | 51,500 |
| 크기 | JSON 1,124,420 bytes, **gzip 129,593 bytes(약 127 KB)** |
| 원천 최신 갱신 | 2026-10-24 14:13:57 |
| 생성 시간 | 상류 3회 포함 약 11.6초 |

판단: 모바일 초기 로드에 gzip 약 127KB — D-01(정적 스냅샷 + 브라우저 탐색) 유지 가능. 배포 방식(빌드 시 생성 / CDN 캐시 함수 등)은 D-10 판정 후 결정.

`shared/`는 브라우저·서버 공용 순수 코드다. `server/`를 가져오지 않고 `console`·`VITE_`를 쓰지 않는다(`repo-guard`).

### 스냅샷 배포 (2026-10-26, D-10 (A) 승인 후)
| 파일 | 내용 |
|---|---|
| `server/snapshot-build.ts` | `Station`·`Bus`·`StationRoute` 3회 호출(키 없음) → `buildSnapshot`. HTTP 오류·`resultCode`≠`00`·0건·가공 후 정류장/노선 0개면 **예외 → 빌드 실패**(빈 데이터 배포 금지, 운영은 직전 배포 유지) |
| `vite.config.ts` | `transit-snapshot` 플러그인: `VERCEL=1`(Vercel 빌드) 또는 `SNAPSHOT_FETCH=1`일 때만 생성해 `dist/data/transit-snapshot.v1.json`으로 넣음. 그 밖의 로컬 빌드는 생략(경고) |
| `shared/sources.ts` | `SNAPSHOT_PATH` |
| `src/data/httpSnapshotSource.ts` | 고정 경로 파일 1개만 요청(위치와 무관 — PRIV R-1), 형식 검사 실패 시 `inconsistent`로 전부 버림, 실패는 기억하지 않고 재시도 |
| `src/data/DataAttribution.tsx` | 출처 "제주특별자치도 버스정보시스템 (공공데이터포털)" + 스냅샷 생성 시각(KST) |

검증: `npm test` 89개 통과(신규 8개), `npm run build` 통과. `SNAPSHOT_FETCH=1` 로컬 빌드는 상류 접속 불가로 **빌드 실패 확인**(의도된 동작). 브라우저 점검(가상 스냅샷): 정류장명 검색 결과·좌표 없는 정류장 선택 불가·출처 표시, 요청은 `/`와 스냅샷 파일뿐. 실제 데이터 생성은 Vercel 미리보기 빌드에서 확인(아래).

**Vercel 미리보기 빌드 확인(2026-10-26, 커밋 d74a343, 상류 호출 3회):**
- 빌드 로그: `정류장 4352·노선 991·원천 갱신 2026-10-24 14:13:57`, `dist/data/transit-snapshot.v1.json` 1,124KB / gzip 129.6KB, 빌드 13.5초
- 배포 파일 응답 200, `content-type: application/json`, `cache-control: public, max-age=0, must-revalidate`(ETag 재검증), brotli 압축
- 내용 검사: `schemaVersion 1`, 정류장 4,352(좌표 확인 불가 1 — 406002082), 노선 991, 노선-정류장 행 51,500, 노선의 모든 정류장 ID가 정류장 목록에 존재 — TASK-009 실측과 동일
- 같은 빌드 로그에 Vercel 함수 타입 검사 경고 2건(`Array.prototype.at`, `server/bis-analysis.ts`·`shared/bis-convert.ts`) — 이번 변경 이전 코드(ebcb6ce)이고 배포는 정상 완료. 별도 정리 대상

갱신: 배포할 때만 갱신된다(R-23). 주기·방법은 D-28(미결).

## 수용 기준
- 좌표 없는 정류장이 "좌표 있음" 타입으로 변환되지 않는다(테스트).
- 시간 값은 출처(실시간/추정)와 함께만 존재할 수 있다.
- 변환기는 필드 누락 픽스처에서 임의 값을 생성하지 않는다(테스트).
- 모든 결과 상태에 대응하는 테스트가 있다.

## 산출물
`src/domain/`, `src/data/` (경로는 구현 시 확정), 단위 테스트

## 보류 조건
TASK-005 미완료 시 실응답 변환기는 보류(인터페이스·상태 모델만 진행 가능).
