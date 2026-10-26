# 제주 버스정보시스템 OpenAPI 명세 요약 (D-09)

| 항목 | 내용 |
|---|---|
| 원본 | `JTBIS-SW-DE-014` OpenAPI 정의서 Ver 2.0 (제주특별자치도청, 2018. 10) — 사용자 제공 HWP, 2026-10-26 |
| 저장소 반입 | **요약만 반입.** 원본에는 담당자 이름·연락처·이메일이 있어 커밋하지 않음 |
| 성격 | **명세(문서) 요약.** 실제 응답은 검증하지 않았음 — 필드명·좌표계·코드·인증 방식은 TASK-005 실호출로 확인해야 함(AGENTS.md 규칙 8) |
| 관련 | GATE-01~05, U-006, D-01·D-04·D-10·D-19·D-21, TASK-005·006·007 |

## 1. 서비스 개요 (명세 기준)

| 항목 | 명세 내용 | 확인 필요 사항 |
|---|---|---|
| 기본 URL | `http://busopen.jeju.go.kr/OpenAPI/service/bis/{오퍼레이션}` (개발·운영 동일) | **HTTP(비암호화)만 기재.** HTTPS 지원 여부 확인 — 지원하지 않으면 서버키가 평문으로 전송됨(R-20) |
| 인터페이스 | REST (GET 쿼리 또는 POST XML 본문) | — |
| 데이터 형식 | XML | JSON 지원 여부 확인 |
| 인증 | 서비스 보안 항목은 "**없음**"으로 표기, 그러나 각 요청 항목에 `serviceKey`(발급받은 키값)가 있고 POST 예제는 `<header><key>0000</key></header>` | 키 필요 여부·발급처(공공데이터포털 LINK 활용신청인지) 확인 |
| 성능 | 오퍼레이션별 초당 최대 30 tps, 평균 응답 0.5 ms(명세값) | 실측 |
| 페이지 | `numOfRows`, `pageNo`, `totalCount` | 한 페이지 최대 행 수 확인 |
| 결과 코드 | `resultCode` `00` = "NOMAL SERVICE"(원문 철자) | **오류·한도 초과 코드 목록 없음** → 실호출로 확인(D-11) |
| 제공자 로그 | 성공 시 Header, 실패 시 Header·Body 로깅 | 우리 요청에는 사용자 좌표가 없음(정류장·노선 ID만) — PRIV 영향 없음 |

## 2. 오퍼레이션 목록과 PRD 매핑

| # | 오퍼레이션 | 입력 | 주요 출력(명세) | PRD 용도 |
|---|---|---|---|---|
| 10 | **Station** 정류소 목록 | `last`(수정일자, 증분) | `stationId`, `stationNm`, `localX`(경도), `localY`(위도), `dirTp`(정류소 방향), `govNm`, `mobiNum`, `upd`, `useYn` | **GATE-01**, FR-003·004 — 정적 스냅샷 원천(D-01) |
| 16 | **Station2** 정류소 목록(다국어) | `last` | Station 항목 + `stationNmEn`·`Ch`·`Jp` | 위와 동일(다국어는 MVP 제외 범위이나 데이터는 존재) |
| 7 | **Bus** 버스노선 목록 | `last` | `routeId`, `routeNm`(예: 7-28), `routeNum`, `routeSubNm`, `routeTp`, `orgtStationId`(기점), `dstStationId`(종점), `stationCnt`, `routeLen`, `routeColor`, `upd`, `useYn` | GATE-02, FR-013(노선 표시) |
| 11 | **StationRoute** 경유정류소(전체 매핑) | `last` | `routeId`, `stationId`, **`stationOrd`(정류소 순번)**, **`updnDir`(상하행)**, `routeDist`(기점 대비 거리 m), `waypointOrd`, `upd`, `useYn` | **GATE-02·03**, FR-008·009 — 경로 엔진 인덱스 |
| 13 | StationRoutePr 경유정류소(노선 선택) | `route` | StationRoute와 동일 | 노선별 검증·갱신 |
| 12 | StationRoutePs 경유정류소(정류소 선택) | `station` | StationRoute와 동일 | 정류장 경유 노선 확인 |
| 3 | **BusArrives** 도착예정버스 | `station` | `routeId`, `stationOrd`, `updnDir`, `leftStation`(남은 정류소), **`predictTravTm`(도착예정시간, 분)**, **`calcDate`(산출일시)**, `arrvVhId` | **GATE-04**, FR-005 — `/api/arrivals` 상류 후보 |
| 4 | BusArriveInfo 노선·정류소별 도착 | `route`, `station` | BusArrives와 동일 | FR-005(특정 노선) |
| 5 | BusArriveList 승하차 구간 버스 | `route`, `from`·`to`(정류소 순번) | `arrvStationId`, `arrvVhId`, `leftStation`, `predictTravTm`, `calcDate`, `stationOrd` | GATE-05 참고(구간 내 운행 버스) |
| 6 | BusArrived 도착 이벤트 | `station`(명세에 "노선ID"로도 표기 — 모호) | `routeId`, `stationOrd`, `vhId`, `eventDate` | 참고 |
| 2 | BusPosition 버스 위치 | `route` | `arrvStationId`, `plateNo`, `lowPlateTp` | MVP 제외(실시간 차량 추적 화면은 PRD §8.3 제외) |
| 1 | BusLocation 노선 버스 위치 정류소 | `route` | `localX`·`localY`, `stationId`·`Nm`·`Ord`, `updnDir`, `routeId`·`Nm` | 참고 |
| 8 | **BusInfo** 노선부가정보 | `route` | `holidayTp`(평일·토·공휴일), `upFirstTime`·`upLastTime`·`dnFirstTime`·`dnLastTime`("첫차/막차 시격"), `minInterval`·`maxInterval`(배차 간격) | **GATE-04(FR-014)** 후보 — 전체 시간표가 아니라 첫·막차와 배차 간격 범위만 |
| 9 | LowBusInfo 저상버스 일정 | — | `routeId`, `vhId`, `startTime`, `arrvTime` | 저상버스 한정 |
| 14 | BusVehicle 차량 목록 | `last` | `vhId`, `plateNo`, `lowPlateTp` | 사용 안 함 |
| 15 | BitService BIT 제공 정보 | `bit` 또는 `serviceStation` | `predictTravleMin`, `remainStation`, `serviceType`(0 도착이벤트·1 인접구간·2 도착예측·3 운행계획), `serviceRunType`(기본·막차·첫차) | GATE-04 참고 |
| 17 | Notice 공지사항 | `last` | 공지 | 사용 안 함 |

코드표(별첨): `updnDir` 0=상행·1=하행 / `holidayTp` 0=비정기·1=평일·2=토요일·3=공휴일(일요일 포함) / `routeTp` 11~43(시내·농어촌·마을·시외 구분) / `serviceType` 0~3 / `serviceRunType` 0 기본·1 막차·2 첫차.

## 3. PRD 요구사항별 가용성 예비 판단 (명세 기준 — 확정 아님)

| 요구 | 명세상 근거 | 예비 판단 | 확인 TASK |
|---|---|---|---|
| GATE-01 정류장 ID·명칭·좌표 | Station/Station2 `stationId`·`stationNm`·`localX`·`localY` | 가능해 보임. 예시 좌표(126.43, 33.45)는 경위도 형태 → **WGS84 여부, 좌표 누락 비율 실측 필요** | 005 |
| GATE-02 정차 순서·방향 | StationRoute `stationOrd`·`updnDir` | 가능해 보임. 순환 노선 표현·`updnDir` 의미(상행/하행이 실제 진행 방향과 대응하는지) 확인 필요(D-21) | 006 |
| GATE-03 ID 정합성 | StationRoute `stationId`·`routeId` ↔ Station·Bus | 실데이터로 교차 검증 필요. 명세 표에서 StationRoute의 `routeId` 설명이 "정류소번호"로 잘못 적혀 있음 | 006 |
| GATE-04 실시간 도착 | BusArrives `predictTravTm`(분), `leftStation`, `calcDate` | 가능해 보임. **`calcDate`(산출일시)가 있어 D-04 신선도 판정 근거가 될 수 있음** | 005 |
| GATE-04 시간표 대체(FR-014) | BusInfo 첫·막차, 최소·최대 배차 간격 / BitService `serviceType=3`(운행계획) | **정류장별 검증된 시간표는 명세에 없음.** 배차 간격 범위로 도착 시각을 만드는 것은 "검증된 시간표"로 보기 어려움 → FR-014 범위 재검토 가능성 | 005 → 사용자 |
| GATE-05 버스 구간 이동시간 | StationRoute `routeDist`(거리)만 있음. 시간 데이터 없음. BusArriveList는 운행 중 버스의 예측값 | **정적 구간 소요시간 원천 없음** → 실시간 예측값 활용 가능성과 한계 검토 필요 | 007 |
| D-16 운행 궤적 | `waypointOrd`(접속노드 순번)만 있고 노드 좌표 없음 | 궤적 데이터 없음 → D-16(연결선 미표시)과 일치 | — |
| D-19 환승 정류장 | Station `dirTp`(정류소 방향) | 같은 이름의 방향별 정류장이 다른 ID일 가능성 → TASK-006에서 분포 확인 | 006 |
| D-10 재배포 | 명세에 이용 조건 없음 | 포털 "이용허락범위 제한 없음" 외 연계처 조건 확인 필요 | 005 |
| 증분 갱신 | Station·Bus·StationRoute에 `last`(수정일자) | 정적 스냅샷 갱신에 유리(D-01) | 005 |

## 4. 명세의 오류·모호점 (실호출로 확인할 것)

- 응답 예제가 `<item>` 대신 `<time>`으로 열리고 `</item>`으로 닫힘, `</reponse>` 철자 — 예제 신뢰도 낮음
- `calcData`/`calcDate` 혼용, `<useeyn>`/`useYn` 혼용
- BusArrived의 `station` 항목명이 "노선ID"로 표기
- StationRoute·StationRoutePs·StationRoutePr의 `routeId` 설명이 "정류소번호"
- 오퍼레이션 목록의 `BusPasition` 철자
- 문서 작성일 2018-10 — 공공데이터포털 수정일은 2026-10-15이므로 현재 운영 사양과 다를 수 있음

## 5. TASK-005 실호출 계획 (승인 필요)

| 순서 | 호출 | 목적 | 예상 호출 수 |
|---|---|---|---|
| 1 | `Station?last=` (전체) 또는 페이지 단위 | GATE-01: 건수·좌표·누락률·좌표계 | 정류장 수 ÷ 페이지 크기 |
| 2 | `Bus?last=` | 노선 수·`useYn` | 소수 |
| 3 | `StationRoutePr?route=` 샘플 3~5개 노선 | 응답 형식 확인(GATE-02 본조사는 TASK-006) | 5 이하 |
| 4 | `BusArrives?station=` 샘플 3개 정류장 × 2회(간격 두고) | GATE-04: 필드·`calcDate` 갱신 주기(D-04) | 6 |
| 5 | `BusInfo?route=` 샘플 3개 | FR-014 가능성 | 3 |
| 6 | 잘못된 키·잘못된 파라미터 1회씩 | 오류 응답 형식(D-11) | 2~3 |

- 호출은 서버 측(로컬 스크립트 또는 서버 함수)에서만, 키는 환경변수로만 사용하고 결과 기록 전 `maskSecrets` 적용.
- 응답 샘플은 키·불필요 정보를 제거한 뒤 픽스처로 저장.
- 필요 네트워크 허용: `busopen.jeju.go.kr` (HTTP 80, HTTPS 지원 시 443).
