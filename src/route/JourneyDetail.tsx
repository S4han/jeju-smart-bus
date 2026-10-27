// 경로 상세(TASK-030) — 공식 BIS·카카오·네이버처럼 시간 막대 + 출발→승차→(환승)→하차→도착 세로 단계
// 시간은 실시간 예측으로 계산된 경우에만(구성요소 그대로) 표시하고, 아니면 "미확인"(AC-010·AC-014). 지도에 선은 그리지 않는다(D-16)
import type { Route, RouteId, Stop, StopId } from "../../shared/domain";
import { formatDistance } from "../stops/nearby";
import { formatClock, stopNameWithDirection, formatDuration, routeNumber, routeVariant } from "./display";
import type { RankedJourney } from "./ranking";
import { journeySteps, type Step, type StopRef } from "./steps";
import { walkMinutesOf } from "./timing";

interface JourneyDetailProps {
  ranked: RankedJourney;
  label: string;
  routesById: ReadonlyMap<RouteId, Route>;
  stopsById: ReadonlyMap<StopId, Stop>;
  originLabel: string;
  destinationLabel: string;
  // 계산 기준 시각(지금)
  now: number;
  children?: React.ReactNode;
}

type BoardStep = Extract<Step, { kind: "board" }>;

const stopName = (s: StopRef, stopsById: ReadonlyMap<StopId, Stop>) =>
  s.name ? stopNameWithDirection({ name: s.name, direction: stopsById.get(s.id)?.direction }) : `정류장 번호 ${s.id} (이름 확인 불가)`;

// 구성요소(대기·이동·환승·도보) → 구간별 분. 시간이 계산되지 않았으면 null
function legMinutes(ranked: RankedJourney) {
  const c = ranked.totalTime?.components;
  if (!c) return null;
  const waits = c.filter((x) => x.kind === "wait" || x.kind === "transfer").map((x) => x.minutes);
  const rides = c.filter((x) => x.kind === "ride").map((x) => x.minutes);
  const walk = c.find((x) => x.kind === "walk")?.minutes ?? 0;
  if (waits.length !== ranked.journey.legs.length || rides.length !== ranked.journey.legs.length) return null;
  return { waits, rides, walk };
}

export function JourneyDetail({ ranked, label, routesById, stopsById, originLabel, destinationLabel, now, children }: JourneyDetailProps) {
  const { journey, totalTime } = ranked;
  const steps = journeySteps(journey, stopsById, routesById);
  const boards = steps.filter((s): s is BoardStep => s.kind === "board");
  const times = legMinutes(ranked);
  const originWalk = walkMinutesOf(journey.originWalkMeters);
  const destWalk = walkMinutesOf(journey.destinationWalkMeters);

  // 단계별 시각(예측): 승차 = 지금 + 누적 대기·이동, 하차 = 승차 + 이동
  const clock: { board: number[]; alight: number[]; end: number } | null = times
    ? (() => {
        let t = 0;
        const board: number[] = [];
        const alight: number[] = [];
        journey.legs.forEach((_, i) => {
          t += times.waits[i];
          board.push(now + t * 60_000);
          t += times.rides[i];
          alight.push(now + t * 60_000);
        });
        return { board, alight, end: now + (t + times.walk) * 60_000 };
      })()
    : null;

  const last = journey.legs[journey.legs.length - 1];
  const lastStop: StopRef = { id: last.alightStopId, name: stopsById.get(last.alightStopId)?.name ?? null, coordinates: null };

  return (
    <article className="journey-detail" aria-label={`${label} 경로 상세`}>
      <p className="journey-label">{label}</p>
      {totalTime ? (
        <>
          <p className="journey-total">{formatDuration(totalTime.minutes)}</p>
          <p className="journey-clock">
            {formatClock(now)} – {formatClock(now + totalTime.minutes * 60_000)} 도착 예정
            <small>{totalTime.estimated ? " · 추정 포함 · 실시간 예측" : " · 실시간 예측"}</small>
          </p>
        </>
      ) : (
        <>
          <p className="journey-total is-unknown">소요시간 미확인</p>
          <p className="journey-clock">연결은 확인된 경로입니다. 실시간 예측이 이어지지 않아 시간을 계산하지 못했습니다.</p>
        </>
      )}

      {/* 시간 막대: 구간 비율은 계산된 분(대기는 도보 포함). 시간이 없으면 정류장 수 비율, 분 표시 없음 */}
      <div className="journey-bar" aria-hidden="true">
        {times && times.waits[0] > 0 && (
          <span className="journey-bar-seg is-wait" style={{ flexGrow: times.waits[0] }}>
            {times.waits[0]}분
          </span>
        )}
        {journey.legs.map((leg, i) => (
          <span key={i} className="journey-bar-group" style={{ flexGrow: times ? times.rides[i] + (i > 0 ? times.waits[i] : 0) : leg.alightOrder - leg.boardOrder }}>
            {times && i > 0 && times.waits[i] > 0 && (
              <span className="journey-bar-seg is-wait" style={{ flexGrow: times.waits[i] }}>
                {times.waits[i]}분
              </span>
            )}
            <span className="journey-bar-seg is-bus" style={{ flexGrow: times ? times.rides[i] : 1 }}>
              <span className="journey-bar-num">{routeNumber(routesById.get(leg.routeId), leg.routeId)}</span>
              {times && <span>{times.rides[i]}분</span>}
            </span>
          </span>
        ))}
        {times && times.walk > 0 && (
          <span className="journey-bar-seg is-walk" style={{ flexGrow: times.walk }}>
            {times.walk}분
          </span>
        )}
      </div>

      <ol className="journey-timeline">
        <li className="tl-node is-origin">
          <span className="tl-dot" aria-hidden="true">출발</span>
          <div className="tl-body">
            <p className="tl-title">{originLabel}</p>
            {clock && <p className="tl-time">{formatClock(now)}</p>}
          </div>
        </li>
        <li className="tl-walk">
          도보 {formatDistance(journey.originWalkMeters)}
          {originWalk > 0 && ` · 약 ${originWalk}분`} <small>(직선거리 추정)</small>
        </li>
        {boards.map((b, i) => {
          const route = routesById.get(b.routeId);
          const variant = routeVariant(route);
          return (
            <li key={i} className="tl-node is-bus">
              <span className="tl-dot" aria-hidden="true">
                🚌
              </span>
              <div className="tl-body">
                <p className="tl-title">
                  {stopName(b.stop, stopsById)} {i === 0 ? "승차" : "환승"}
                  <span className="tl-stop-id">{b.stop.id}</span>
                </p>
                {clock && <p className="tl-time">{formatClock(clock.board[i])} 승차 예정</p>}
                <div className="tl-route">
                  <span className="bus-pill">{routeNumber(route, b.routeId)}</span>
                  <span className="tl-route-meta">
                    {variant && <small>{variant} · </small>}
                    {b.towards ? `${stopName(b.towards, stopsById)} 방면` : "방면 확인 불가"}
                  </span>
                </div>
                {times && (
                  <p className="tl-next">
                    버스 도착 예정 {clock ? Math.round((clock.board[i] - now) / 60_000) : times.waits[i]}분 후
                    <small> (실시간 예측)</small>
                  </p>
                )}
                {b.via.length > 0 ? (
                  <details className="route-via">
                    <summary>
                      {b.stopsToRide}개 정류장 이동{times ? ` · ${times.rides[i]}분` : ""}
                    </summary>
                    <ol>
                      {b.via.map((v, j) => (
                        <li key={`${v.id}-${j}`}>{stopName(v, stopsById)}</li>
                      ))}
                    </ol>
                  </details>
                ) : (
                  <p className="tl-ride">
                    {b.stopsToRide}개 정류장 이동{times ? ` · ${times.rides[i]}분` : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        <li className="tl-node is-alight">
          <span className="tl-dot" aria-hidden="true">하차</span>
          <div className="tl-body">
            <p className="tl-title">
              {stopName(lastStop, stopsById)} 하차<span className="tl-stop-id">{lastStop.id}</span>
            </p>
            {clock && <p className="tl-time">{formatClock(clock.alight[clock.alight.length - 1])}</p>}
          </div>
        </li>
        <li className="tl-walk">
          도보 {formatDistance(journey.destinationWalkMeters)}
          {destWalk > 0 && ` · 약 ${destWalk}분`} <small>(직선거리 추정)</small>
        </li>
        <li className="tl-node is-destination">
          <span className="tl-dot" aria-hidden="true">도착</span>
          <div className="tl-body">
            <p className="tl-title">{destinationLabel}</p>
            {clock && <p className="tl-time">{formatClock(clock.end)} 도착 예정</p>}
          </div>
        </li>
      </ol>
      {children}
    </article>
  );
}
