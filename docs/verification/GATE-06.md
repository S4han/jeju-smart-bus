# GATE-06 — API 인증·무료 한도·요금·약관·초과 과금 차단 검증

| 항목 | 내용 |
|---|---|
| TASK | TASK-003 |
| 차수 | **1차 (공개 문서 조사)** — 2026-10-26 |
| 판정 | **미완료.** 0원 보장이 확인된 서비스 없음. 사용자 콘솔 확인 필요 항목 있음(§4) |
| 관련 | NFR-001, NFR-002, U-006, FR-017, PRD §7 운영 정책 |

> PRD §7: 무료 제공 여부·초과 과금 방지 수단이 검증되지 않은 외부 서비스는 운영에 적용하지 않는다.
> 이 문서의 "사용 가능" 판정도 사용자 콘솔 확인(§4) 전에는 운영 적용 근거가 되지 않는다.

## 1. 조사 방법과 한계

이번 세션의 네트워크 정책이 다음 호스트를 차단(프록시 403)해 원문을 직접 열람하지 못했다:
`guide.ncloud-docs.com`, `www.ncloud.com`, `www.gov-ncloud.com`, `vercel.com`, `devtalk.kakao.com`, `developers.naver.com`, `business.juso.go.kr`, `openapi.sk.com`, `tmapapi.tmapmobility.com`. `www.vworld.kr`는 503 응답.

| 근거 등급 | 의미 |
|---|---|
| **A — 원문 열람** | 공식 페이지 본문을 직접 읽음 |
| **B — 검색 요약** | 검색 엔진 결과 요약에 공식 URL이 나왔으나 본문은 열람하지 못함. 재확인 필요 |
| **C — 미확인** | 정보 없음 |

외부 API 실호출은 하지 않았다.

## 2. 서비스별 판정 요약

| 서비스 | 용도 | 비용 구조 | 한도 초과 시 | 판정 | 근거 |
|---|---|---|---|---|---|
| 공공데이터포털 API (제주·TAGO) | 정류장·노선·도착 | 무료 | 오류 코드 22·23 반환(과금 없음) | **사용 가능 후보** — 단 LINK 연계처 조건 미확인 | A |
| 제주 버스 LINK 연계 API (15058442 등) | 정류장·노선·순번·위치 | 포털 표기 "무료" | 미확인 | **조건부** — 연계처 약관·한도·인증 확인 필요 | A(포털), C(연계처) |
| NAVER Cloud Maps (Web Dynamic Map) | 지도 표시(PoC 사용 중) | **신규 Maps 상품: 대표 계정 1개 한정 월 6,000,000건 무료.** 사용자 확인(2026-10-26): **신규 Maps·대표 계정** | 초과 단가·한도 차단 여부 미확인 | **조건부** — 무료 적용 확인(D-15 ①). 한도 도달 시 차단(D-15 ②) 미확인 | A + 사용자 확인, C(한도 차단) |
| Vercel Hobby | 호스팅·서버 함수 | 무료 플랜, **청구 주기·초과 과금 없음** | 대부분 30일 경과까지 해당 기능 사용 불가 | **사용 가능(0원)** — 사용자 확인(2026-10-26): Hobby 플랜, 비상업 개인 프로젝트. 조건: Marketplace 연동·광고 미도입 | A + 사용자 확인 |
| Kakao 로컬(키워드 검색)·도보 경로 | 장소 검색·도보시간 후보 | 무료 쿼터 + 선택적 유료 | 429 오류(유료 설정 안 하면) | **사용 가능 후보** — 조건 §3.4 | A |
| NAVER 검색 API(지역) | 장소 검색 후보 | 신규는 NAVER API HUB 경유. HUB 요금표: **검색 API 0~775,000건 0원, 일 최대 25,000건 호출 제한** | 일 한도 초과 시 429(개발자센터 문서). HUB 종량제·임계치 설정 기능 있음 | **조건부(유력)** — 일 한도가 무료 구간 안에 머무는 구조. 콘솔에서 초과 과금 여부 확인 | A |
| 행정안전부 도로명주소 API | 주소 검색 후보 | 미확인 | 미확인 | 미확인 | C |
| VWorld 검색 API | 장소 검색 후보 | 미확인 | 미확인 | 미확인 | C |
| TMAP 보행자 경로 | 도보시간 후보 | 미확인 | 미확인 | 미확인 | C |

## 3. 서비스별 상세

### 3.1 공공데이터포털 — 제주 버스 관련 (근거 A)

| 데이터 | URL | 유형·포맷 | 비용 | 이용허락범위 | 심의 | 수정일 | 제공 항목(설명 기준) |
|---|---|---|---|---|---|---|---|
| 제주특별자치도_버스정보시스템 | [15058442](https://www.data.go.kr/data/15058442/openapi.do) | LINK, XML | 무료 | 제한 없음 | 개발·운영 자동승인 | 2026-10-15 | 버스 위치(위경도), 정류소ID·번호·명, **정류소순번**, 노선ID·번호·타입, 목적지, **상하행** |
| 제주특별자치도_버스 정류소 기본 정보 | [15074255](https://www.data.go.kr/data/15074255/openapi.do) | LINK, JSON | 무료 | 제한 없음 | 개발 자동 / 운영 심의 | 2026-10-15 | 정류소ID·타입·명, 주소, 방향, 경도, 위도 |
| 제주특별자치도_버스 노선 기본 정보 | [15074254](https://www.data.go.kr/data/15074254/openapi.do) | LINK, JSON | 무료 | 제한 없음 | 개발 자동 / 운영 심의 | 2026-10-15 | 노선ID·이름·번호, 시종점 정류소, 정류소 개수, 노선거리 |
| 제주 버스정류소현황(파일) | [15010850](https://www.data.go.kr/data/15010850/fileData.do) | CSV | 무료 | 제한 없음 | — | 2025-07-31 | 정류소ID·명, 경도, 위도, 주변설명 (4,080행, 1회성) |
| 국토교통부 TAGO 버스도착정보 | [15098530](https://www.data.go.kr/data/15098530/openapi.do) | REST, JSON/XML | 무료 | 제한 없음 | 자동승인 | 2023-07-12 | 정류소별 도착예정(남은 정류장 수, `arrtime` 초 단위). 개발계정 10,000건 |

관찰:
- 포털 표기상 **과금 구조 없음**. 일일 한도 초과 시 오류 22(`LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR`), 초당 초과 시 23 반환 — FR-017 한도 소진 감지 근거로 사용 가능(D-11).
- 제주 API 3종은 **LINK 유형**이라 실제 호출처·인증 방식·트래픽 한도가 포털에 없다. 기술문서 `[19A_DHUP]API기술문서_BUS.hwp`가 참고문서로 첨부되어 있음 → D-09(명세 제공)와 연계.
- TAGO 도착정보가 **제주를 포함하는지 미확인**(도시코드 목록 조회 필요 → TASK-005 실호출).
- 정류소 CSV는 2025-07-31 기준 1회성 데이터 → 정적 스냅샷 원천으로는 갱신성 문제. 노선별 정차 순서가 없어 경로 엔진에는 부족(GATE-02).
- "이용허락범위 제한 없음" 표기는 D-10(정적 스냅샷 재배포)에 유리한 근거이나, LINK 연계처 약관은 별도 확인 필요.

### 3.2 NAVER Cloud Maps (근거 A — 2차 조사 2026-10-26, `www.ncloud.com` 허용 후 원문 열람)

출처: [Maps 상품·요금](https://www.ncloud.com/product/applicationService/maps), [공지 1930 (2025-03-24)](https://www.ncloud.com/support/notice/all/1930), [공지 1965 (2025-05-28, 수정 2025-06-23)](https://www.ncloud.com/support/notice/all/1965)

| 구분 | 내용(원문) |
|---|---|
| 신규 **Maps** 상품(2025-03-20 출시) 요금 | "Dynamic Map 이용 횟수 6,000,000건 이하 무료 — ※ **대표 계정 1개에 한해 월 6,000,000건**의 무료 이용량을 제공합니다." (Static Map·Geocoding·Reverse Geocoding 각 월 3,000,000건, Directions 5 월 60,000건, Directions 15 월 3,000건) |
| 초과 단가 | 요금표의 초과 구간 요금 칸이 정적 HTML에 비어 있음(" - ") → **미확인** |
| 구 **AI NAVER API** 지도 | 2025-04-17부터 Application에 지도 API 추가 불가. "25.07.01부터 AI NAVER API 서비스에서 지도 API에 대한 월 무료 이용량 혜택이 종료되어 **100% 유료 과금**됩니다." / "AI NAVER API 내 지도 API 상품은 무료 이용량을 제공하지 않습니다." |
| 이용 한도 설정·차단 | 가이드(`guide.ncloud-docs.com`)가 **사이트 보안 필터로 자동 요청 거부(403)** → 원문 미확인. 우회 시도하지 않음 |
| 요청 데이터 처리(PRIV-004) | 미확인 |

해석:
- 1차 조사의 "상충"은 **상품 차이**였다. 무료 종료는 구 AI NAVER API에 해당하고, 신규 Maps 상품은 대표 계정에 월 600만 건 무료다.
- PoC는 `ncpKeyId` 파라미터를 쓰고, 구 상품은 2025-04-17 이후 지도 API 신규 추가가 막혔으며, Vercel 프로젝트는 2026-10 생성 → **신규 Maps 상품일 가능성이 높음**(추정, 콘솔 확인 필요).
- **사용자 확인(2026-10-26): 신규 Maps 상품, 대표 계정** → D-15 판단 기준 ①(무료 적용) **충족**. ②(한도 도달 시 차단)는 **미확인**.
- 참고: NCP Directions는 도보 경로가 아니므로 D-06(도보시간) 후보가 아님(상품명 기준, 상세 미확인).

### 3.3 Vercel Hobby (근거 A — 2차 조사 2026-10-26, `vercel.com` 허용 후 원문 열람)

출처: [Hobby 플랜](https://vercel.com/docs/plans/hobby), [Fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [Limits](https://vercel.com/docs/limits), [Runtime logs](https://vercel.com/docs/logs/runtime)

| 항목 | 원문 |
|---|---|
| 과금 | "As the Hobby plan is a free tier there are no billing cycles. In most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again." |
| 이용 범위 | "the Hobby plan restricts users to non-commercial, personal use only." |
| 상업적 이용 정의 | "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project, including **a paid employee or consultant writing the code**." 예: 제품·서비스 판매 광고, 광고(AdSense 등) 게재. "Asking for Donations" 는 상업적 이용 아님 |
| 포함 사용량(월) | Function Invocations 1,000,000 / CDN Requests 1,000,000 / Fast Data Transfer 100 GB / Fast Origin Transfer 10 GB / Active CPU 4 CPU-hrs / Provisioned Memory 360 GB-hrs |
| 로그 보존 | "Build logs are stored indefinitely for each deployment. **Runtime logs are stored for 1 hour on Hobby**, 1 day on Pro, and for 3 days on Enterprise accounts." |
| 런타임 로그 항목 | Request Path("the actual URL path requested by users"), Request Method, Status, Request Id 등. 쿼리스트링 포함 여부는 문서에 명시 없음 → 포함될 수 있다고 보고 설계(PRIV-002 규칙 유지) |

계정 확인(Vercel API 조회, 읽기만): 프로젝트 `jeju-smart-bus`, Node `24.x`, 도메인 `jeju-smart-bus-psi.vercel.app`, 미리보기 배포 SSO 보호 활성. 팀 `splendid3`의 **요금제는 API 응답에 없어 미확인**.

판정: **사용 가능(0원).** 사용자 확인(2026-10-26): 팀 요금제 Hobby, 비상업 개인 프로젝트. Hobby는 초과 과금이 없고 한도 초과 시 기능 정지(FR-017 장애 대응 대상). 유지 조건: Marketplace 연동(Blob·KV·DB) 금지, 광고·유료 판매 미도입, 유급 업무로 전환 시 재검토.

### 3.4 Kakao 로컬·도보 경로 (근거 A)

출처: [카카오맵 공통](https://developers.kakao.com/docs/latest/ko/kakaomap/common), [쿼터](https://developers.kakao.com/docs/latest/ko/getting-started/quota), [운영정책](https://developers.kakao.com/terms/latest/ko/site-policies)

| 항목 | 내용 |
|---|---|
| 무료 쿼터(일) | 키워드로 장소 검색 100,000건, 도보 경로 조회 1,000건 |
| 무료 쿼터(월) | 전체 API 3,000,000건 ("추후 변경될 수 있습니다") |
| 대상 | "개발자 계정 기준 **첫 번째로 활성화한 앱에만** 무료 쿼터" |
| 초과 시 | "무료 제공량을 모두 소진한 경우, **429 에러**가 발생합니다." |
| 유료 전환 | 비즈월렛 연결 + 유료 API 사용 설정 시에만 사용량 과금(키워드 2원/건, 도보 10원/건) |
| 변경 이력 | 2026-07-21부터 사용 방법·무료 쿼터 방식 변경(공지 본문 미열람) |
| 캐시·저장 | 운영정책 제5조: 사용자 환경 개선 목적 외 캐시 금지·최신 유지 의무(20호), 사전 동의 없는 데이터 복사·제공 금지(30호) |
| 키 노출 | 지도 SDK는 JavaScript 키(도메인 등록), REST API 키의 브라우저 사용 가능 여부는 미확인 |
| 좌표 처리 조건 | 미확인 → PRIV-004(TASK-002·008) |

판정: **비즈월렛을 연결하지 않고 첫 번째 앱으로 사용하면 초과 시 429로 차단되어 0원 유지 가능**(문서 기준). 운영 적용은 콘솔 확인(§4) 후.

설계 영향: REST 키를 서버에 둬야 한다면 도보 경로 요청의 **좌표가 자체 서버 함수를 경유**한다 → D-01(좌표 서버 미도달) 원칙과 충돌. 선택지: (a) 키워드 검색은 좌표 없이 텍스트만 전송 (b) 도보시간은 서버 경유 시 요청 본문·무로그·`no-store` 조건으로 PRIV 재검증 (c) 브라우저 JS SDK 경유 가능 여부 확인. → D-05·D-06 결정 시 고려.

### 3.5 미확인 서비스 (근거 C)

NAVER 검색 API(지역): `developers.naver.com` 허용 후 원문 열람 — 상세는 `U-001-place-search.md` §3-A. 행정안전부 도로명주소 API, VWorld 검색 API, TMAP 보행자 경로: 원문 접근 불가. 해당 호스트 접근 허용 후 재조사 또는 후보 제외 여부를 사용자가 결정.

## 4. 사용자 확인 요청 (콘솔·계정 화면)

계정 정보·키·결제 정보는 이 문서나 채팅에 붙이지 말고 결과만 알려 주세요.

| # | 확인 항목 | 위치 | 시급도 |
|---|---|---|---|
| 1 | ~~상품·대표 계정~~ **확인 완료(2026-10-26): 신규 Maps, 대표 계정**. 남은 것: 이번 달 Maps 이용 요금이 0원인지(청구 예정액) | NCP 콘솔 > 비용 관리 | 중간 |
| 2 | NAVER Cloud: 이용 한도 설정 기능이 한도 도달 시 호출을 **차단**하는지(통보만인지), 설정 가능 여부 — 가이드가 자동 접근을 거부해 사용자 확인만 가능 | NCP 콘솔 > Maps > 이용 한도 설정 | 높음 |
| 3 | NAVER Cloud: 결제수단 등록 여부 | NCP 콘솔 > 결제 | 높음 |
| 4 | ~~Vercel 팀 요금제~~ | **확인 완료(2026-10-26): Hobby** | — |
| 5 | ~~비상업 이용 여부~~ | **확인 완료(2026-10-26): 비상업 개인 프로젝트** | — |
| 6 | Kakao Developers 사용 시: 첫 번째 활성화 앱인지, 비즈월렛 미연결 유지 | Kakao Developers 콘솔 | 공급자 선택 시 |
| 7 | 공공데이터포털 제주 LINK API 활용신청 후 안내되는 실제 호출처·한도 | 활용신청 후 마이페이지 | TASK-005 전 |
| 8 | 차단된 문서 호스트 허용 여부(재조사용) | 클라우드 환경 설정 > Network access | 선택 |

## 5. 결론

- **0원 보장 확정 서비스: 없음.** 공공데이터포털(과금 구조 없음)과 Kakao(유료 설정 미사용 시 429 차단)가 가장 유력하다.
- **NAVER 지도는 기존 PoC가 사용 중이므로 §4-1 확인이 최우선이다.** 확인 결과 과금이 발생하거나 차단 장치가 없으면 D-15(대안 검토)를 진행해야 한다.
  - **D-15 판단 기준(승인 2026-10-26):** ① 무료 이용량 적용 ② 한도 도달 시 호출 차단 — 둘 다 확인되면 유지. 하나라도 확인되지 않으면 운영 미적용 + 대안 지도 검토 안 제출(대안 선정은 별도 승인).
- Vercel은 요금제·비상업 해당 여부 확인 전까지 D-02 전제(GATE-06)가 충족되지 않았다.
- 이 문서는 운영 적용 근거가 아니며, §4 확인 후 2차 판정을 기록한다.
