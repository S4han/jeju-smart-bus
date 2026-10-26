// 경로 탐색 엔진 (TASK-016, FR-008·FR-009·FR-016, AC-008·AC-009·AC-016, D-19·D-21·D-26)
// 규칙 기반·결정적. 검증된 연결만 경로로 만든다:
// - 한 구간 = 같은 노선에서 승차 순번 < 하차 순번(AC-008). 끝 → 처음 넘김 없음, 같은 정류장이 여러 번 나오면 순번 차이가 가장 작은 조합(D-21)
// - 환승 = 앞 구간 하차 정류장 ID = 다음 구간 승차 정류장 ID(D-19), 바로 앞 구간과 같은 노선으로는 갈아타지 않음
// - 환승은 최대 2회(AC-009). 3회 이상은 만들지 않는다
// 소요시간은 다루지 않는다(TASK-017). 걷는 거리는 출발지·목적지와 후보 정류장 사이 직선거리(D-03)다.

import type { Route, RouteId, StopId } from "../../shared/domain";

export const MAX_TRANSFERS = 2;
// 같은 노선 조합(예: 노선 A → 노선 B)에서 대표 경로 하나만 남긴다. 대표 선택 기준: 걷는 거리 합 → 탄 정류장 수 합 → 식별자
// 환승 횟수별로 남기는 경로 수 상한(D-29 (A) 승인 2026-10-26)
export const MAX_JOURNEYS_PER_TRANSFER_COUNT = 30;
// 환승을 줄여도 되는 경로 제외: 뒤 구간 노선이 그 하차 지점 전에 승차 후보 정류장을 지나면(거기서 바로 타면 됨),
// 앞 구간 노선이 그 승차 지점 이후에 하차 후보 정류장을 지나면(계속 타고 가면 됨) 그 경로는 만들지 않는다(D-29 (A) 승인 2026-10-26)
export const PRUNE_REPLACEABLE_TRANSFERS = true;

export interface Candidate {
  stopId: StopId;
  walkMeters: number;
}

export interface Leg {
  routeId: RouteId;
  boardStopId: StopId;
  // 노선 내 순번(1부터)
  boardOrder: number;
  alightStopId: StopId;
  alightOrder: number;
}

export interface Journey {
  // 고정 식별자(D-07): 구간별 "노선ID:승차정류장ID>하차정류장ID"를 탑승 순서대로 "|"로 연결
  id: string;
  legs: Leg[];
  transfers: number;
  originWalkMeters: number;
  destinationWalkMeters: number;
  walkMeters: number;
  // 탄 정류장 수 합(하차 순번 − 승차 순번)
  rideStops: number;
}

export type SearchResult =
  | { status: "ok"; journeys: Journey[] }
  // no_route: 검증된 연결 없음 / data_unavailable: 후보 정류장을 지나는 노선의 데이터가 불완전해 판단할 수 없음
  | { status: "empty"; reason: "no_route" | "data_unavailable" };

interface ValidRoute {
  route: Route;
  // 정류장 → 이 노선에서의 위치(0부터) 목록
  positions: Map<StopId, number[]>;
}

// 입력 검증: 정류장 2개 이상, 모든 정류장이 정류장 목록에 있음. 아니면 탐색에서 제외(AC-016)
export function indexRoutes(routes: ReadonlyArray<Route>, knownStops: ReadonlySet<StopId>) {
  const valid: ValidRoute[] = [];
  const invalidStops = new Set<StopId>();
  for (const route of routes) {
    const ok = route.stopIds.length >= 2 && route.stopIds.every((id) => knownStops.has(id));
    if (!ok) {
      for (const id of route.stopIds) invalidStops.add(id);
      continue;
    }
    const positions = new Map<StopId, number[]>();
    route.stopIds.forEach((id, i) => positions.set(id, [...(positions.get(id) ?? []), i]));
    valid.push({ route, positions });
  }
  const byStop = new Map<StopId, ValidRoute[]>();
  for (const v of valid) for (const id of v.positions.keys()) byStop.set(id, [...(byStop.get(id) ?? []), v]);
  return { valid, byStop, invalidStops };
}

export type RouteIndex = ReturnType<typeof indexRoutes>;

interface Partial1 {
  leg: Leg;
  walk: number;
  rideStops: number;
}

const legOf = (r: ValidRoute, i: number, j: number): Leg => ({
  routeId: r.route.id,
  boardStopId: r.route.stopIds[i],
  boardOrder: i + 1,
  alightStopId: r.route.stopIds[j],
  alightOrder: j + 1,
});

// D-07 고정 식별자 구간 표기: 노선ID:승차정류장ID>하차정류장ID
export const legKey = (l: Leg) => `${l.routeId}:${l.boardStopId}>${l.alightStopId}`;

// a가 b보다 나으면 음수: 걷기 → 탄 정류장 수 → 식별자
function comparePartial(a: Partial1, b: Partial1): number {
  return a.walk - b.walk || a.rideStops - b.rideStops || cmp(legKey(a.leg), legKey(b.leg));
}
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// 후보 정류장에서 한 구간으로 갈 수 있는 정류장: 정류장 → (노선 → 가장 나은 구간)
function forwardReach(index: RouteIndex, origins: ReadonlyArray<Candidate>) {
  const reach = new Map<StopId, Map<RouteId, Partial1>>();
  for (const o of origins) {
    for (const r of index.byStop.get(o.stopId) ?? []) {
      for (const i of r.positions.get(o.stopId)!) {
        for (let j = i + 1; j < r.route.stopIds.length; j++) {
          const t = r.route.stopIds[j];
          if (t === o.stopId) continue;
          offer(reach, t, { leg: legOf(r, i, j), walk: o.walkMeters, rideStops: j - i });
        }
      }
    }
  }
  return reach;
}

// 한 구간으로 하차 후보에 닿을 수 있는 승차 정류장: 정류장 → (노선 → 가장 나은 구간)
function backwardReach(index: RouteIndex, destinations: ReadonlyArray<Candidate>) {
  const reach = new Map<StopId, Map<RouteId, Partial1>>();
  for (const d of destinations) {
    for (const r of index.byStop.get(d.stopId) ?? []) {
      for (const j of r.positions.get(d.stopId)!) {
        for (let i = j - 1; i >= 0; i--) {
          const t = r.route.stopIds[i];
          if (t === d.stopId) continue;
          offer(reach, t, { leg: legOf(r, i, j), walk: d.walkMeters, rideStops: j - i });
        }
      }
    }
  }
  return reach;
}

function offer(reach: Map<StopId, Map<RouteId, Partial1>>, stop: StopId, p: Partial1) {
  let byRoute = reach.get(stop);
  if (!byRoute) reach.set(stop, (byRoute = new Map()));
  const cur = byRoute.get(p.leg.routeId);
  if (!cur || comparePartial(p, cur) < 0) byRoute.set(p.leg.routeId, p);
}

function makeJourney(legs: Leg[], originWalk: number, destinationWalk: number): Journey {
  return {
    id: legs.map(legKey).join("|"),
    legs,
    transfers: legs.length - 1,
    originWalkMeters: originWalk,
    destinationWalkMeters: destinationWalk,
    walkMeters: originWalk + destinationWalk,
    rideStops: legs.reduce((n, l) => n + l.alightOrder - l.boardOrder, 0),
  };
}

// 결과 순서: 환승 횟수 → 걷는 거리 → 고정 식별자(FR-015 순서와 같은 축). 화면 정렬은 ranking.ts(TASK-017)
export function compareJourneys(a: Journey, b: Journey): number {
  return a.transfers - b.transfers || a.walkMeters - b.walkMeters || cmp(a.id, b.id);
}

// 같은 노선 조합 안에서 대표 고르기: 걷는 거리 → 탄 정류장 수 → 식별자(D-29 (A) 승인)
function compareRepresentative(a: Journey, b: Journey): number {
  return a.walkMeters - b.walkMeters || a.rideStops - b.rideStops || cmp(a.id, b.id);
}

// 환승이 더 적은 경로로 바꿀 수 있는지 — 바꾼 경로는 같은 규칙으로 항상 유효하다
// 노선별 "승차 후보가 처음 나오는 위치"·"하차 후보가 마지막으로 나오는 위치"를 미리 구해 둔다
interface EndpointPositions {
  firstOrigin: Map<RouteId, number>;
  lastDest: Map<RouteId, number>;
}

function endpointPositions(index: RouteIndex, originSet: ReadonlySet<StopId>, destSet: ReadonlySet<StopId>): EndpointPositions {
  const firstOrigin = new Map<RouteId, number>();
  const lastDest = new Map<RouteId, number>();
  const mark = (ids: ReadonlySet<StopId>, f: (r: ValidRoute, positions: number[]) => void) => {
    for (const id of ids) for (const r of index.byStop.get(id) ?? []) f(r, r.positions.get(id)!);
  };
  mark(originSet, (r, ps) => firstOrigin.set(r.route.id, Math.min(firstOrigin.get(r.route.id) ?? Infinity, ...ps)));
  mark(destSet, (r, ps) => lastDest.set(r.route.id, Math.max(lastDest.get(r.route.id) ?? -Infinity, ...ps)));
  return { firstOrigin, lastDest };
}

// 앞 구간(마지막이 아닌 구간): 승차 뒤에 하차 후보가 있으면 계속 타면 된다
const canRideToDestination = (pos: EndpointPositions, leg: Leg) => (pos.lastDest.get(leg.routeId) ?? -1) >= leg.boardOrder;
// 뒤 구간(첫 구간이 아닌 구간): 하차 전에 승차 후보가 있으면 거기서 바로 타면 된다
const canBoardFromOrigin = (pos: EndpointPositions, leg: Leg) => (pos.firstOrigin.get(leg.routeId) ?? Infinity) < leg.alightOrder - 1;

function isReplaceable(legs: ReadonlyArray<Leg>, pos: EndpointPositions) {
  return legs.some((leg, k) => (k > 0 && canBoardFromOrigin(pos, leg)) || (k < legs.length - 1 && canRideToDestination(pos, leg)));
}

export function findJourneys(
  index: RouteIndex,
  origins: ReadonlyArray<Candidate>,
  destinations: ReadonlyArray<Candidate>,
  limitPerTransferCount = MAX_JOURNEYS_PER_TRANSFER_COUNT,
): SearchResult {
  const destWalk = new Map(destinations.map((d) => [d.stopId, d.walkMeters]));
  const forward = forwardReach(index, origins);
  const backward = backwardReach(index, destinations);
  const levels: Array<Map<string, Journey>> = [new Map(), new Map(), new Map()];
  const pos = endpointPositions(index, new Set(origins.map((o) => o.stopId)), new Set(destinations.map((d) => d.stopId)));
  // 환승 경로의 첫 구간·마지막 구간 중 항상 제외될 것은 미리 거른다(2회 환승의 "가장 나은 첫 구간"이 제외될 구간으로 고정되지 않도록)
  const usable = (reach: Map<StopId, Map<RouteId, Partial1>>, ok: (p: Partial1) => boolean) => {
    const out = new Map<StopId, Partial1[]>();
    for (const [stop, byRoute] of reach) {
      const list = [...byRoute.values()].filter((p) => !PRUNE_REPLACEABLE_TRANSFERS || ok(p));
      if (list.length > 0) out.set(stop, list);
    }
    return out;
  };
  const firsts = usable(forward, (p) => !canRideToDestination(pos, p.leg));
  const lasts = usable(backward, (p) => !canBoardFromOrigin(pos, p.leg));

  // 노선 조합별 대표: 걷기·탄 정류장 수로 먼저 비교하고, 나을 때만 경로 객체를 만든다
  const consider = (level: number, key: string, walkO: number, walkD: number, ride: number, legs: () => Leg[]) => {
    const cur = levels[level].get(key);
    const walk = walkO + walkD;
    if (cur && (walk > cur.walkMeters || (walk === cur.walkMeters && ride > cur.rideStops))) return;
    const built = legs();
    if (PRUNE_REPLACEABLE_TRANSFERS && level > 0 && isReplaceable(built, pos)) return;
    const j = makeJourney(built, walkO, walkD);
    if (!cur || compareRepresentative(j, cur) < 0) levels[level].set(key, j);
  };

  // 직행: 승차 후보에서 한 구간으로 하차 후보에 닿음
  for (const [stop, walk] of destWalk) {
    for (const p of forward.get(stop)?.values() ?? []) consider(0, p.leg.routeId, p.walk, walk, p.rideStops, () => [p.leg]);
  }

  // 1회 환승: 같은 정류장 ID에서 다른 노선으로
  for (const [t, as] of firsts) {
    const bs = lasts.get(t);
    if (!bs) continue;
    for (const a of as) {
      for (const b of bs) {
        if (a.leg.routeId !== b.leg.routeId) consider(1, `${a.leg.routeId}>${b.leg.routeId}`, a.walk, b.walk, a.rideStops + b.rideStops, () => [a.leg, b.leg]);
      }
    }
  }

  // 2회 환승: 가운데 노선을 따라가며, 앞에서 만난 환승 정류장 중 가장 나은 첫 구간을 이어 붙인다
  if (MAX_TRANSFERS >= 2) {
    for (const mid of index.valid) {
      const stops = mid.route.stopIds;
      let best: { p: Partial1; at: number } | null = null;
      for (let k = 0; k < stops.length; k++) {
        const t = stops[k];
        if (best && stops[best.at] !== t) {
          const from = best;
          for (const b of lasts.get(t) ?? []) {
            if (b.leg.routeId === mid.route.id) continue;
            const ride = from.p.rideStops + (k - from.at) + b.rideStops;
            consider(2, `${from.p.leg.routeId}>${mid.route.id}>${b.leg.routeId}`, from.p.walk, b.walk, ride, () => [from.p.leg, legOf(mid, from.at, k), b.leg]);
          }
        }
        for (const a of firsts.get(t) ?? []) {
          if (a.leg.routeId === mid.route.id) continue;
          // 걷기·첫 구간이 같으면 더 뒤의 순번(가운데 구간이 짧은 쪽)을 쓴다
          if (!best || comparePartial(a, best.p) < 0 || (comparePartial(a, best.p) === 0 && best.at !== k)) best = { p: a, at: k };
        }
      }
    }
  }

  const journeys = levels.flatMap((m) => [...m.values()].sort(compareJourneys).slice(0, limitPerTransferCount));
  if (journeys.length > 0) return { status: "ok", journeys };
  const touchesInvalid = [...origins, ...destinations].some((c) => index.invalidStops.has(c.stopId));
  return { status: "empty", reason: touchesInvalid ? "data_unavailable" : "no_route" };
}
