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
    });
  });
  steps.push({ kind: "alight", stop: ref(last.alightStopId) });
  steps.push({ kind: "walk_to_destination", meters: journey.destinationWalkMeters, from: ref(last.alightStopId) });
  return steps;
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
