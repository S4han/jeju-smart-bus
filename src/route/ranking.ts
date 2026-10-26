// 소요시간·정렬·결과 구성 (TASK-017, FR-010·FR-011·FR-012·FR-015, AC-010·AC-011·AC-012·AC-015, D-07)
// - 총 소요시간은 모든 구성요소가 검증된 경우에만 합산한다. 하나라도 없으면 "미확인"(AC-010)
// - 시간 확인 경로: 총 소요시간 → 환승 → 도보시간 → 고정 식별자, 상위 3개(AC-011·AC-012)
// - 시간 미확인 경로: 환승 → 도보거리 확인 가능 우선 → 도보거리 → 고정 식별자, 상위 5개(AC-015)
// 비교는 모두 오름차순이고 마지막 키가 고정 식별자라 입력 순서와 무관하게 결과가 같다.

import type { TimeComponent } from "../../shared/domain";
import type { Journey } from "./engine";

export const RECOMMENDED_LIMIT = 3;
export const TIME_UNKNOWN_LIMIT = 5;

// 출발지·목적지와 후보 정류장 사이 직선거리를 AC-015의 "도보거리"로 쓸지 — 미확정 설정값(D-06).
// true면 직선거리를 "확인 가능한 도보거리"로 정렬에 쓰고 화면에 "직선" 거리로 표시한다
export const STRAIGHT_LINE_AS_WALK_DISTANCE = true;

export type ComponentKind = "walk" | "wait" | "ride" | "transfer";

export interface TotalTime {
  minutes: number;
  // 구성요소 중 하나라도 추정이면 전체가 추정(AC-010·AC-014)
  estimated: boolean;
  components: Array<TimeComponent & { kind: ComponentKind }>;
}

// 필요한 구성요소가 하나라도 null(미검증)이면 합산하지 않는다
export function sumTime(components: ReadonlyArray<(TimeComponent & { kind: ComponentKind }) | null>): TotalTime | null {
  if (components.length === 0 || components.some((c) => c === null || !Number.isFinite(c.minutes) || c.minutes < 0)) return null;
  const known = components as Array<TimeComponent & { kind: ComponentKind }>;
  return {
    minutes: known.reduce((n, c) => n + c.minutes, 0),
    estimated: known.some((c) => c.source === "estimated"),
    components: [...known],
  };
}

export interface RankedJourney {
  journey: Journey;
  totalTime: TotalTime | null;
  // 도보시간(분) — 총 소요시간이 있을 때 정렬 2순위 뒤 키(AC-011)
  walkMinutes: number | null;
  // 도보거리(m) — 확인 불가면 null(AC-015)
  walkMeters: number | null;
}

// 코드 단위 사전순(D-07: 로케일 비의존)
const cmpId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function compareRecommended(a: RankedJourney, b: RankedJourney): number {
  return (
    a.totalTime!.minutes - b.totalTime!.minutes ||
    a.journey.transfers - b.journey.transfers ||
    (a.walkMinutes ?? Infinity) - (b.walkMinutes ?? Infinity) ||
    cmpId(a.journey.id, b.journey.id)
  );
}

export function compareTimeUnknown(a: RankedJourney, b: RankedJourney): number {
  const known = (r: RankedJourney) => (r.walkMeters === null ? 1 : 0);
  return (
    a.journey.transfers - b.journey.transfers ||
    known(a) - known(b) ||
    (a.walkMeters !== null && b.walkMeters !== null ? a.walkMeters - b.walkMeters : 0) ||
    cmpId(a.journey.id, b.journey.id)
  );
}

export interface ResultSections {
  recommended: RankedJourney[];
  timeUnknown: RankedJourney[];
}

export interface TimeEstimator {
  // 검증된 근거로 총 소요시간을 낼 수 없으면 null
  totalTime(journey: Journey): TotalTime | null;
  walkMinutes(journey: Journey): number | null;
}

// 실시간 예측을 불러오기 전·실패 시 기본값: 시간 근거 없음 → 모든 경로가 시간 미확인(실시간 예측 산정은 timing.ts)
export const UNVERIFIED_TIME: TimeEstimator = { totalTime: () => null, walkMinutes: () => null };

export function buildResultSections(journeys: ReadonlyArray<Journey>, time: TimeEstimator = UNVERIFIED_TIME): ResultSections {
  const ranked = journeys.map((journey): RankedJourney => {
    const totalTime = time.totalTime(journey);
    return {
      journey,
      totalTime,
      walkMinutes: totalTime ? time.walkMinutes(journey) : null,
      walkMeters: STRAIGHT_LINE_AS_WALK_DISTANCE ? journey.walkMeters : null,
    };
  });
  return {
    recommended: ranked.filter((r) => r.totalTime !== null).sort(compareRecommended).slice(0, RECOMMENDED_LIMIT),
    timeUnknown: ranked.filter((r) => r.totalTime === null).sort(compareTimeUnknown).slice(0, TIME_UNKNOWN_LIMIT),
  };
}
