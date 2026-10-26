# 제주 BIS 실응답 픽스처 (TASK-005)

2026-10-26 Vercel 미리보기 프로브(`api/bis-probe`, `key=none`)로 관찰한 실제 응답에서 발췌했다.
키·사용자 좌표는 포함하지 않는다. 정류장 좌표는 공개 시설 좌표다.

| 파일 | 출처 | 비고 |
|---|---|---|
| `empty-response.xml` | `BusArrives?station=999999999`, `BusInfo?route=…` 응답 원문 전체 | 없는 ID도 `resultCode 00` + 0건 |
| `station-items.json` | `Station` 응답 항목 3건 | `dirTp`에 문자열 `"null"`, 미사용 정류장 포함 |
| `bus-items.json` | `Bus` 응답 항목 5건 | 미사용(N)·가상·수요응답형 노선 포함 |
| `station-route-items.json` | `StationRoutePr?route=405320114` 앞 2건 + `405502001` 앞 3건 | 순환형 노선은 `updnDir` 전부 0 |
| `bus-arrives-items.json` | `BusArrives?station=406000191`·`405000153` 항목 | 최신 행과 오래된 행(`calcDate` 2024~2025)이 섞임, `arrvVhId 0` = 차량 없음 |
