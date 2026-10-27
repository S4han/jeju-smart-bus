// 경로 단계 안내 (TASK-018, FR-013, AC-013)
// 단계는 경로(엔진 결과)와 스냅샷의 정류장·노선 데이터로만 만든다. 이름이 없으면 만들지 않고 null로 둔다.

import type { Coordinates, Route, RouteId, Stop, StopId } from "../../shared/domain";
import type { Journey } from "./engine";

export interface StopRef {
  id: StopId;
  // 스냅샷에 없으면 null — 이름을 만들지 않는다
  name: string | null;
  coordinates: Coordinates | null;
}

export type Step =
  | { kind: "walk_to_board"; meters: number; to: StopRef }
  | {
      kind: "board";
      stop: StopRef;
      routeId: RouteId;
      routeName: string | null;
      // 이 노선 데이터의 마지막 정류장(운행 순서상 종점) — 방면 안내용
      towards: StopRef | null;
      stopsToRide: number;
      // 타고 가며 지나는 정류장(승차·하차 제외, 노선 정차 순서 그대로) — TASK-029
      via: StopRef[];
    }
  | { kind: "transfer"; stop: StopRef }
  | { kind: "alight"; stop: StopRef }
  | { kind: "walk_to_destination"; meters: number; from: StopRef };

export function journeySteps(
  journey: Journey,
  stopsById: ReadonlyMap<StopId, Stop>,
  routesById: ReadonlyMap<RouteId, Route>,
): Step[] {
  const ref = (id: StopId): StopRef => {
    const s = stopsById.get(id);
    return { id, name: s?.name ?? null, coordinates: s?.coordinates ?? null };
  };
  const steps: Step[] = [];
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  steps.push({ kind: "walk_to_board", meters: journey.originWalkMeters, to: ref(first.boardStopId) });
  journey.legs.forEach((leg, i) => {
    if (i > 0) steps.push({ kind: "transfer", stop: ref(leg.boardStopId) });
    const route = routesById.get(leg.routeId);
    const end = route?.stopIds[route.stopIds.length - 1];
    steps.push({
      kind: "board",
      stop: ref(leg.boardStopId),
      routeId: leg.routeId,
      routeName: route?.name ?? null,
      towards: end ? ref(end) : null,
      stopsToRide: leg.alightOrder - leg.boardOrder,
      via: legViaIds(leg, routesById).map(ref),
    });
  });
  steps.push({ kind: "alight", stop: ref(last.alightStopId) });
  steps.push({ kind: "walk_to_destination", meters: journey.destinationWalkMeters, from: ref(last.alightStopId) });
  return steps;
}

// 한 구간에서 타는 정류장 ID(승차~하차, 노선 정차 순서). 노선 데이터의 승차·하차 순번이 경로와 맞지 않으면 null — 만들지 않는다
function legStopIds(leg: Journey["legs"][number], routesById: ReadonlyMap<RouteId, Route>): StopId[] | null {
  const ids = routesById.get(leg.routeId)?.stopIds;
  if (!ids || ids[leg.boardOrder - 1] !== leg.boardStopId || ids[leg.alightOrder - 1] !== leg.alightStopId) return null;
  return ids.slice(leg.boardOrder - 1, leg.alightOrder);
}

// 승차·하차를 뺀 경유 정류장 ID
function legViaIds(leg: Journey["legs"][number], routesById: ReadonlyMap<RouteId, Route>): StopId[] {
  return legStopIds(leg, routesById)?.slice(1, -1) ?? [];
}

// 정류장 순서 연결선(D-33): 구간마다 승차~하차 정류장 좌표를 정차 순서대로 잇는다. 실제 도로 궤적이 아니다.
// 좌표가 없는 정류장에서는 선을 끊고(임의 위치로 잇지 않음), 노선 순번이 맞지 않는 구간은 그리지 않는다
export function journeyStopPath(journey: Journey, stopsById: ReadonlyMap<StopId, Stop>, routesById: ReadonlyMap<RouteId, Route>): Coordinates[][] {
  const segments: Coordinates[][] = [];
  for (const leg of journey.legs) {
    let current: Coordinates[] = [];
    for (const id of legStopIds(leg, routesById) ?? []) {
      const c = stopsById.get(id)?.coordinates;
      if (c) current.push(c);
      else {
        if (current.length >= 2) segments.push(current);
        current = [];
      }
    }
    if (current.length >= 2) segments.push(current);
  }
  return segments;
}

// 지도에 작게 표시할 경유 정류장(모든 구간, 탑승 순서대로)
export function viaStops(journey: Journey, stopsById: ReadonlyMap<StopId, Stop>, routesById: ReadonlyMap<RouteId, Route>): StopRef[] {
  return journey.legs.flatMap((leg) =>
    legViaIds(leg, routesById).map((id) => {
      const s = stopsById.get(id);
      return { id, name: s?.name ?? null, coordinates: s?.coordinates ?? null };
    }),
  );
}

// 지도에 번호를 붙일 정류장 지점: 승차 → 환승 → 하차 순(같은 정류장이 이어지면 한 번만)
export interface StepPoint {
  number: number;
  role: "board" | "transfer" | "alight";
  stop: StopRef;
}

export function stepPoints(journey: Journey, stopsById: ReadonlyMap<StopId, Stop>): StepPoint[] {
  const ref = (id: StopId): StopRef => {
    const s = stopsById.get(id);
    return { id, name: s?.name ?? null, coordinates: s?.coordinates ?? null };
  };
  const points: StepPoint[] = [{ number: 1, role: "board", stop: ref(journey.legs[0].boardStopId) }];
  for (let i = 1; i < journey.legs.length; i++) points.push({ number: points.length + 1, role: "transfer", stop: ref(journey.legs[i].boardStopId) });
  points.push({ number: points.length + 1, role: "alight", stop: ref(journey.legs[journey.legs.length - 1].alightStopId) });
  return points;
}
