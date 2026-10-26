// 제주 BIS 응답 → 도메인 변환과 정적 스냅샷 생성 (TASK-009, D-24·D-26, NFR-004)
// 입력은 XML에서 꺼낸 문자열 레코드. 필수 값이 없거나 형식이 틀리면 채우지 않고 제외하며 사유를 센다.

import type { Arrival, Coordinates, Route, RouteId, Stop, StopId } from "./domain.js";

export type RawRecord = Record<string, string | undefined>;

const has = (v: string | undefined): v is string => v !== undefined && v !== "" && v !== "null";
const text = (v: string | undefined) => (has(v) ? v : null);

// 좌표 유효 범위: 제주 본섬 + 추자도(관측 위도 33.94~33.96, 경도 126.29~126.33) — D-26
const VALID_AREAS = [
  { lat: [33.0, 33.7], lng: [126.0, 127.1] },
  { lat: [33.9, 34.0], lng: [126.25, 126.4] },
];

export function toCoordinates(localX: string | undefined, localY: string | undefined): Coordinates | null {
  if (!has(localX) || !has(localY)) return null;
  const lng = Number(localX);
  const lat = Number(localY);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const inside = VALID_AREAS.some((a) => lat >= a.lat[0] && lat <= a.lat[1] && lng >= a.lng[0] && lng <= a.lng[1]);
  // 뒤바뀐 좌표·범위 밖 좌표는 보정하지 않는다(D-24)
  return inside ? { lat, lng } : null;
}

export function toStop(raw: RawRecord): Stop | null {
  if (!has(raw.stationId) || !has(raw.stationNm)) return null;
  return { id: raw.stationId, name: raw.stationNm, coordinates: toCoordinates(raw.localX, raw.localY) };
}

// BIS 일시 문자열 → epoch ms. 시간대 표기가 없으면 한국 시간(+09:00)으로 본다.
// calcDate 원문 형식은 실응답으로 재확인 필요(TASK-014) — 아래 형식이 아니면 null(실시간 판정 불가)
const BIS_LOCAL_DATETIME = /^(\d{4})-?(\d{2})-?(\d{2})[ T]?(\d{2}):?(\d{2}):?(\d{2})(\.\d+)?$/;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseBisDateTime(value: string | undefined): number | null {
  if (!has(value)) return null;
  const v = value.trim();
  if (ISO_WITH_ZONE.test(v)) {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  const m = v.match(BIS_LOCAL_DATETIME);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59) return null;
  return Date.UTC(y, mo - 1, d, h - 9, mi, sec);
}

export function toArrival(raw: RawRecord): Arrival | null {
  const stopOrder = Number(raw.stationOrd);
  if (!has(raw.routeId) || !Number.isInteger(stopOrder) || stopOrder < 1) return null;
  const calculatedMs = parseBisDateTime(raw.calcDate);
  if (calculatedMs === null) return null;
  const hasVehicle = has(raw.arrvVhId) && raw.arrvVhId !== "0";
  const minutes = Number(raw.predictTravTm);
  const stopsAway = Number(raw.leftStation);
  return {
    routeId: raw.routeId,
    stopOrder,
    vehicleId: hasVehicle ? raw.arrvVhId! : null,
    minutesToArrival: hasVehicle && Number.isFinite(minutes) && minutes >= 0 ? minutes : null,
    stopsAway: hasVehicle && Number.isFinite(stopsAway) && stopsAway >= 0 ? stopsAway : null,
    calculatedAt: new Date(calculatedMs).toISOString(),
    source: "realtime",
  };
}

export interface TransitSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  // 원천 데이터의 최신 갱신 시각(upd 최댓값)
  sourceUpdatedAt: string | null;
  stops: Stop[];
  routes: Route[];
}

export interface SnapshotStats {
  stops: { included: number; notInUse: number; invalidRecord: number; coordinatesUnavailable: number };
  routes: {
    included: number;
    notInUse: number;
    invalidRecord: number;
    singleStopOrLess: number;
    noMapping: number;
    inconsistentOrder: number;
    unknownStop: number;
  };
  routeStopRows: number;
}

export function buildSnapshot(
  stations: RawRecord[],
  buses: RawRecord[],
  stationRoutes: RawRecord[],
  generatedAt: string,
): { snapshot: TransitSnapshot; stats: SnapshotStats } {
  const stats: SnapshotStats = {
    stops: { included: 0, notInUse: 0, invalidRecord: 0, coordinatesUnavailable: 0 },
    routes: { included: 0, notInUse: 0, invalidRecord: 0, singleStopOrLess: 0, noMapping: 0, inconsistentOrder: 0, unknownStop: 0 },
    routeStopRows: 0,
  };

  const stops: Stop[] = [];
  const stopIds = new Set<StopId>();
  for (const raw of stations) {
    if (raw.useYn !== "Y") {
      stats.stops.notInUse++;
      continue;
    }
    const stop = toStop(raw);
    if (!stop || stopIds.has(stop.id)) {
      stats.stops.invalidRecord++;
      continue;
    }
    if (!stop.coordinates) stats.stops.coordinatesUnavailable++;
    stops.push(stop);
    stopIds.add(stop.id);
  }
  stats.stops.included = stops.length;

  // 사용 중 노선의 사용 중 매핑 행만(D-26). stationCnt·updnDir은 쓰지 않는다
  const rowsByRoute = new Map<RouteId, RawRecord[]>();
  for (const row of stationRoutes) {
    if (row.useYn !== "Y" || !has(row.routeId)) continue;
    rowsByRoute.set(row.routeId, [...(rowsByRoute.get(row.routeId) ?? []), row]);
  }

  const routes: Route[] = [];
  for (const bus of buses) {
    if (bus.useYn !== "Y") {
      stats.routes.notInUse++;
      continue;
    }
    if (!has(bus.routeId) || !has(bus.routeNm)) {
      stats.routes.invalidRecord++;
      continue;
    }
    const rows = rowsByRoute.get(bus.routeId);
    if (!rows) {
      stats.routes.noMapping++;
      continue;
    }
    const ordered = [...rows].sort((a, b) => Number(a.stationOrd) - Number(b.stationOrd));
    // 순번은 1부터 빠짐·중복 없이 이어져야 한다(GATE-02). 아니면 노선 전체를 제외(FR-016)
    if (ordered.some((r, i) => Number(r.stationOrd) !== i + 1)) {
      stats.routes.inconsistentOrder++;
      continue;
    }
    const routeStopIds = ordered.map((r) => r.stationId ?? "");
    if (routeStopIds.some((id) => !stopIds.has(id))) {
      stats.routes.unknownStop++;
      continue;
    }
    if (routeStopIds.length <= 1) {
      stats.routes.singleStopOrLess++;
      continue;
    }
    routes.push({ id: bus.routeId, name: bus.routeNm, subName: text(bus.routeSubNm), type: text(bus.routeTp), stopIds: routeStopIds });
    stats.routeStopRows += routeStopIds.length;
  }
  stats.routes.included = routes.length;

  const updates = [...stations, ...buses].map((r) => r.upd).filter(has).sort();
  return {
    snapshot: {
      schemaVersion: 1,
      generatedAt,
      sourceUpdatedAt: updates.length > 0 ? updates[updates.length - 1] : null,
      stops,
      routes,
    },
    stats,
  };
}
