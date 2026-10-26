// 제주 BIS 노선·경유 정류장 정합성 분석 (TASK-006, GATE-02·03, D-19·D-21) — 검증용
// 입력은 Station·Bus·StationRoute 응답 레코드. 데이터를 보정하지 않고 관찰 결과만 집계한다.

import type { XmlRecord } from "./xml-summary.js";

const EXAMPLES = 10;
const JEJU_LNG = [126.0, 127.1];
const JEJU_LAT = [33.0, 33.7];

const isSet = (v: string | undefined) => v !== undefined && v !== "" && v !== "null";

function push<T>(list: T[], item: T, limit = EXAMPLES) {
  if (list.length < limit) list.push(item);
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

interface StopPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  inUse: boolean;
  dirTp: string;
}

function validPoint(r: XmlRecord): StopPoint | null {
  const lng = Number(r.localX);
  const lat = Number(r.localY);
  const ok = lng >= JEJU_LNG[0] && lng <= JEJU_LNG[1] && lat >= JEJU_LAT[0] && lat <= JEJU_LAT[1];
  return ok
    ? { id: r.stationId, name: r.stationNm ?? "", lat, lng, inUse: r.useYn === "Y", dirTp: r.dirTp ?? "" }
    : null;
}

// 제주 본섬 범위 밖 정류장 목록 — 도서 지역(추자도 등)인지 오류인지 사람이 분류하도록 그대로 보여준다
export function outOfRangeStations(stations: XmlRecord[]) {
  return stations
    .filter((r) => isSet(r.localX) && isSet(r.localY) && !validPoint(r))
    .map((r) => ({ stationId: r.stationId, stationNm: r.stationNm, localX: r.localX, localY: r.localY, useYn: r.useYn }));
}

// D-19 근거: 같은 이름 정류장 묶음과 서로 가까운 다른 ID 정류장 분포(사용 중 정류장 기준)
export function nearbyStationStats(stations: XmlRecord[]) {
  const points = stations.map(validPoint).filter((p): p is StopPoint => p !== null && p.inUse);
  const byName = new Map<string, StopPoint[]>();
  for (const p of points) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);

  const sameNameGroups = [...byName.values()].filter((g) => g.length > 1);
  const sameNameNearest: number[] = [];
  const sameNameExamples: Array<{ name: string; ids: string[]; dirTp: string[]; maxPairMeters: number }> = [];
  for (const g of sameNameGroups) {
    let maxPair = 0;
    for (let i = 0; i < g.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j < g.length; j++) {
        if (i === j) continue;
        const d = haversineMeters(g[i].lat, g[i].lng, g[j].lat, g[j].lng);
        nearest = Math.min(nearest, d);
        maxPair = Math.max(maxPair, d);
      }
      sameNameNearest.push(nearest);
    }
    push(sameNameExamples, { name: g[0].name, ids: g.map((p) => p.id), dirTp: g.map((p) => p.dirTp), maxPairMeters: Math.round(maxPair) });
  }

  // 격자로 근접 쌍을 센다(200m 이내)
  const cell = 0.002;
  const grid = new Map<string, StopPoint[]>();
  const key = (lat: number, lng: number) => `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
  for (const p of points) grid.set(key(p.lat, p.lng), [...(grid.get(key(p.lat, p.lng)) ?? []), p]);
  const pairBuckets = { within30m: 0, within50m: 0, within100m: 0, within200m: 0 };
  let samePosition = 0;
  for (const p of points) {
    const cy = Math.floor(p.lat / cell);
    const cx = Math.floor(p.lng / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const q of grid.get(`${cy + dy}:${cx + dx}`) ?? []) {
          if (q.id <= p.id) continue;
          const d = haversineMeters(p.lat, p.lng, q.lat, q.lng);
          if (d === 0) samePosition++;
          if (d <= 30) pairBuckets.within30m++;
          if (d <= 50) pairBuckets.within50m++;
          if (d <= 100) pairBuckets.within100m++;
          if (d <= 200) pairBuckets.within200m++;
        }
      }
    }
  }

  const bucket = (limit: number) => sameNameNearest.filter((d) => d <= limit).length;
  return {
    inUseWithValidCoordinates: points.length,
    sameNameGroups: sameNameGroups.length,
    stationsInSameNameGroups: sameNameNearest.length,
    sameNameNearestDistance: { le30m: bucket(30), le50m: bucket(50), le100m: bucket(100), le200m: bucket(200), over200m: sameNameNearest.length - bucket(200) },
    sameNameExamples,
    differentIdPairs: { ...pairBuckets, samePosition },
  };
}

// GATE-02·03: 노선별 정차 순서·방향·정류장 참조 정합성
// activeRowsOnly: 사용 중 노선 안에서도 useYn=Y 매핑 행만 본다(미사용 행이 섞여 생기는 불일치 확인용)
export function routeIntegrity(
  stations: XmlRecord[],
  buses: XmlRecord[],
  stationRoutes: XmlRecord[],
  { activeRowsOnly = false } = {},
) {
  const stationById = new Map(stations.map((s) => [s.stationId, s]));
  const busById = new Map(buses.map((b) => [b.routeId, b]));
  const rowsByRoute = new Map<string, XmlRecord[]>();
  for (const r of stationRoutes) {
    if (activeRowsOnly && r.useYn !== "Y") continue;
    rowsByRoute.set(r.routeId, [...(rowsByRoute.get(r.routeId) ?? []), r]);
  }

  const activeRouteIds = buses.filter((b) => b.useYn === "Y").map((b) => b.routeId);
  const issues = {
    activeRoutesWithoutMapping: [] as string[],
    mappingRoutesNotInBus: 0,
    ordDuplicate: [] as string[],
    ordGap: [] as string[],
    ordNotStartingAt1: [] as string[],
    stationMissingInStationList: [] as string[],
    stationNotInUse: [] as string[],
    stationCoordinatesInvalid: [] as string[],
    stationCntMismatch: [] as string[],
    originMismatch: [] as string[],
    destinationMismatch: [] as string[],
    routeDistDecreasing: [] as string[],
    mappingRowsNotInUse: [] as string[],
  };
  const counts = Object.fromEntries(Object.keys(issues).map((k) => [k, 0])) as Record<keyof typeof issues, number>;
  const note = (k: keyof typeof issues, routeId: string) => {
    counts[k]++;
    const list = issues[k];
    if (Array.isArray(list)) push(list as string[], routeId);
  };

  const direction = { allZero: 0, allOne: 0, both: 0, other: 0 };
  const directionExamples: Record<string, string[]> = { both: [], other: [] };
  let circularFirstEqualsLast = 0;
  let repeatedStationRoutes = 0;
  const stopsPerRoute: number[] = [];
  let activeMappingRows = 0;

  for (const id of [...rowsByRoute.keys()]) if (!busById.has(id)) counts.mappingRoutesNotInBus++;

  for (const routeId of activeRouteIds) {
    const rows = rowsByRoute.get(routeId);
    if (!rows || rows.length === 0) {
      note("activeRoutesWithoutMapping", routeId);
      continue;
    }
    activeMappingRows += rows.length;
    stopsPerRoute.push(rows.length);
    const bus = busById.get(routeId)!;
    const sorted = [...rows].sort((a, b) => Number(a.stationOrd) - Number(b.stationOrd));
    const ords = sorted.map((r) => Number(r.stationOrd));

    if (new Set(ords).size !== ords.length) note("ordDuplicate", routeId);
    if (ords[0] !== 1) note("ordNotStartingAt1", routeId);
    if (ords.some((o, i) => i > 0 && o - ords[i - 1] > 1)) note("ordGap", routeId);
    if (sorted.some((r, i) => i > 0 && Number(r.routeDist) < Number(sorted[i - 1].routeDist))) note("routeDistDecreasing", routeId);
    if (sorted.some((r) => r.useYn !== "Y")) note("mappingRowsNotInUse", routeId);
    if (isSet(bus.stationCnt) && Number(bus.stationCnt) !== rows.length) note("stationCntMismatch", routeId);
    if (isSet(bus.orgtStationId) && sorted[0].stationId !== bus.orgtStationId) note("originMismatch", routeId);
    if (isSet(bus.dstStationId) && !sorted.some((r) => r.stationId === bus.dstStationId)) note("destinationMismatch", routeId);

    let missing = false;
    let notInUse = false;
    let invalidCoord = false;
    for (const r of sorted) {
      const s = stationById.get(r.stationId);
      if (!s) missing = true;
      else {
        if (s.useYn !== "Y") notInUse = true;
        if (!validPoint(s)) invalidCoord = true;
      }
    }
    if (missing) note("stationMissingInStationList", routeId);
    if (notInUse) note("stationNotInUse", routeId);
    if (invalidCoord) note("stationCoordinatesInvalid", routeId);

    const dirs = new Set(sorted.map((r) => r.updnDir));
    if (dirs.size === 1 && dirs.has("0")) direction.allZero++;
    else if (dirs.size === 1 && dirs.has("1")) direction.allOne++;
    else if (dirs.size === 2 && dirs.has("0") && dirs.has("1")) {
      direction.both++;
      push(directionExamples.both, routeId, 5);
    } else {
      direction.other++;
      push(directionExamples.other, routeId, 5);
    }

    if (sorted[0].stationId === sorted[sorted.length - 1].stationId) circularFirstEqualsLast++;
    if (new Set(sorted.map((r) => r.stationId)).size !== sorted.length) repeatedStationRoutes++;
  }

  stopsPerRoute.sort((a, b) => a - b);
  const pct = (p: number) => stopsPerRoute[Math.min(stopsPerRoute.length - 1, Math.floor(p * stopsPerRoute.length))] ?? null;

  return {
    totals: {
      stations: stations.length,
      routes: buses.length,
      activeRoutes: activeRouteIds.length,
      mappingRows: stationRoutes.length,
      mappingRoutes: rowsByRoute.size,
      activeMappingRows,
    },
    stopsPerActiveRoute: { min: stopsPerRoute[0] ?? null, p50: pct(0.5), p90: pct(0.9), max: stopsPerRoute.at(-1) ?? null },
    direction,
    directionExamples,
    circularFirstEqualsLast,
    routesWithRepeatedStation: repeatedStationRoutes,
    issueCounts: counts,
    issueExamples: issues,
  };
}

// Bus 응답의 명세 외 필드(firstTm·lastTm)와 명세 외 코드값 관찰
export function busFieldStats(buses: XmlRecord[]) {
  const active = buses.filter((b) => b.useYn === "Y");
  const filled = (f: string) => active.filter((b) => isSet(b[f])).length;
  const examples = active.filter((b) => isSet(b.firstTm) || isSet(b.lastTm)).slice(0, 5)
    .map((b) => ({ routeId: b.routeId, routeNm: b.routeNm, firstTm: b.firstTm, lastTm: b.lastTm }));
  const useYnA = buses.filter((b) => b.useYn === "A").slice(0, 5)
    .map((b) => ({ routeId: b.routeId, routeNm: b.routeNm, routeSubNm: b.routeSubNm, routeTp: b.routeTp, upd: b.upd }));
  const routeTp53 = buses.filter((b) => b.routeTp === "53").slice(0, 5)
    .map((b) => ({ routeId: b.routeId, routeNm: b.routeNm, routeSubNm: b.routeSubNm, useYn: b.useYn }));
  const singleStop = active.filter((b) => Number(b.stationCnt) <= 1).length;
  return { activeRoutes: active.length, firstTmFilled: filled("firstTm"), lastTmFilled: filled("lastTm"), examples, useYnA, routeTp53, activeSingleStopRoutes: singleStop };
}
