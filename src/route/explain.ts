// 규칙 기반 경로 설명 (TASK-018, FR-018, AC-018) — 생성형 AI를 쓰지 않는다(FR-019 MVP 제외)
// 값이 있는 근거만 문장으로 만든다. 소요시간·도보시간이 없으면 그 문장을 넣지 않는다.

import { formatDistance } from "../stops/nearby";
import type { RankedJourney } from "./ranking";
import { STRAIGHT_LINE_AS_WALK_DISTANCE } from "./ranking";

export type Section = "recommended" | "time_unknown";

export function explainJourney(ranked: RankedJourney, section: Section): string[] {
  const { journey, totalTime, walkMinutes, walkMeters } = ranked;
  const lines: string[] = [];
  if (section === "recommended") {
    lines.push("총 소요시간이 짧은 순(같으면 환승이 적은 순, 걷는 시간이 짧은 순)으로 고른 경로입니다.");
  } else {
    lines.push("총 소요시간을 확인할 수 없어, 환승이 적고 걷는 거리가 짧은 순으로 보여 주는 경로입니다.");
  }
  if (totalTime) lines.push(`총 소요시간은 ${totalTime.minutes}분${totalTime.estimated ? "이며 추정값이 포함되어 있습니다" : "입니다"}.`);
  lines.push(journey.transfers === 0 ? "갈아타지 않고 한 번에 갑니다." : `같은 정류장에서 ${journey.transfers}번 갈아탑니다.`);
  if (walkMinutes !== null) lines.push(`걷는 시간은 ${walkMinutes}분입니다.`);
  if (walkMeters !== null && STRAIGHT_LINE_AS_WALK_DISTANCE) {
    lines.push(
      `걷는 거리는 직선으로 출발 쪽 ${formatDistance(journey.originWalkMeters)}, 도착 쪽 ${formatDistance(journey.destinationWalkMeters)}입니다(실제 걷는 길은 더 길 수 있습니다).`,
    );
  }
  return lines;
}
