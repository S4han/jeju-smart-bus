// 경로 탐색 시작 조건 안내와 실행 (TASK-015 AC-006·AC-007, TASK-016 AC-008·AC-009·AC-016)
// 결과: 시간 확인 추천(최대 3)·시간 미확인(최대 5) 두 영역(TASK-017), 단계 안내·규칙 설명·비교표(TASK-018 FR-013·018, US-004)
import type { Route, RouteId, Stop, StopId } from "../../shared/domain";
import { formatDistance } from "../stops/nearby";
import { ENDPOINT_LABEL, type EndpointKey, type RouteReadiness } from "./candidates";
import type { SearchResult } from "./engine";
import { buildResultSections, type RankedJourney, type TimeEstimator } from "./ranking";
import type { TimingState } from "./useJourneyTimes";
import { explainJourney, type Section } from "./explain";
import { journeySteps, type Step, type StopRef } from "./steps";

const names = (keys: EndpointKey[]) => keys.map((k) => ENDPOINT_LABEL[k]).join("·");

interface RouteReadinessNoticeProps {
  readiness: RouteReadiness;
  canSearch: boolean;
  onSearch: () => void;
  result: SearchResult | null;
  routesById: ReadonlyMap<RouteId, Route>;
  stopsById: ReadonlyMap<StopId, Stop>;
  selectedJourneyId: string | null;
  onSelectJourney: (id: string | null) => void;
  estimator: TimeEstimator;
  timing: TimingState;
}

export function RouteReadinessNotice({ readiness, canSearch, onSearch, result, ...rest }: RouteReadinessNoticeProps) {
  return (
    <section className="route-readiness" aria-labelledby="route-readiness-title">
      <h2 id="route-readiness-title">경로 찾기</h2>
      <div aria-live="polite">
        {readiness.ready ? (
          <p>
            승차 후보 정류장 {readiness.origin.length}곳, 하차 후보 정류장 {readiness.destination.length}곳으로 경로를 찾을 수
            있습니다.
          </p>
        ) : (
          <ul className="readiness-list">
            {readiness.missing.length > 0 && <li>{names(readiness.missing)}를 정해 주세요.</li>}
            {readiness.needsConsent.length > 0 && (
              <li>{names(readiness.needsConsent)} 반경 500m 안에 정류장이 없습니다. 위의 안내에서 1km까지 넓힐지 정해 주세요.</li>
            )}
            {readiness.noCandidates.length > 0 && (
              <li>
                {names(readiness.noCandidates)} 근처에 이용할 정류장이 없어 경로를 찾지 않습니다. 위치를 바꿔 주세요.
              </li>
            )}
          </ul>
        )}
        {result && <SearchResults result={result} {...rest} />}
      </div>
      <div className="cta-bar">
        <button type="button" className="route-search-button" disabled={!canSearch} onClick={onSearch}>
          경로 찾기
        </button>
      </div>
    </section>
  );
}

interface SearchResultsProps {
  result: SearchResult;
  routesById: ReadonlyMap<RouteId, Route>;
  stopsById: ReadonlyMap<StopId, Stop>;
  selectedJourneyId: string | null;
  onSelectJourney: (id: string | null) => void;
  estimator: TimeEstimator;
  timing: TimingState;
}

function SearchResults({ result, estimator, timing, ...rest }: SearchResultsProps) {
  if (result.status === "empty") {
    return (
      <p className="route-result">
        {result.reason === "no_route"
          ? "검색 가능한 경로가 없습니다. 같은 정류장에서 갈아타는 환승 2회 이내 버스 경로를 찾지 못했습니다."
          : "노선 데이터를 확인할 수 없어 경로를 판단하지 못했습니다."}
      </p>
    );
  }
  const sections = buildResultSections(result.journeys, estimator);
  const shown = [...sections.recommended, ...sections.timeUnknown];
  return (
    <>
      <h3>추천 경로 (소요시간 기준)</h3>
      {sections.recommended.length === 0 ? (
        <p>
          {timing.status === "loading"
            ? "버스 실시간 예측을 불러오는 중입니다…"
            : "지금 실시간 예측으로 소요시간을 계산할 수 있는 경로가 없습니다(제때 탈 수 있는 차량의 도착 예측이 경로와 이어지지 않음)."}
        </p>
      ) : (
        <>
          <p className="route-note">
            버스 실시간 예측(제주 버스정보시스템)과 걷는 시간 추정(직선거리 기준)으로 계산했습니다. 예측은 몇 분씩 바뀔 수 있습니다.
          </p>
          <ol className="route-list">
            {sections.recommended.map((r) => (
              <JourneyItem key={r.journey.id} ranked={r} section="recommended" {...rest} />
            ))}
          </ol>
        </>
      )}
      {timing.status === "ready" && timing.failedRoutes > 0 && (
        <p className="route-note">일부 노선({timing.failedRoutes}개)의 실시간 예측을 불러오지 못해 해당 경로는 소요시간 미확인으로 두었습니다.</p>
      )}
      {sections.timeUnknown.length > 0 && (
        <>
          <h3>소요시간 미확인 경로</h3>
          <p className="route-note">연결이 확인된 경로입니다. 총 소요시간은 확인할 수 없어 표시하지 않습니다. 환승이 적고 걷는 거리가 짧은 순입니다.</p>
          <ol className="route-list">
            {sections.timeUnknown.map((r) => (
              <JourneyItem key={r.journey.id} ranked={r} section="time_unknown" {...rest} />
            ))}
          </ol>
        </>
      )}
      <CompareTable rows={shown} routesById={rest.routesById} />
    </>
  );
}

type ItemProps = { ranked: RankedJourney; section: Section } & Omit<SearchResultsProps, "result" | "estimator" | "timing">;

const routeLabel = (routesById: ReadonlyMap<RouteId, Route>, j: RankedJourney["journey"]) =>
  j.legs.map((l) => routesById.get(l.routeId)?.name ?? `노선 ${l.routeId}`).join(" → ");
const stopLabel = (s: StopRef) => s.name ?? `정류장 번호 ${s.id} (이름 확인 불가)`;

function JourneyItem({ ranked, section, routesById, stopsById, selectedJourneyId, onSelectJourney }: ItemProps) {
  const { journey, totalTime } = ranked;
  const selected = journey.id === selectedJourneyId;
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  const name = (id: StopId) => stopsById.get(id)?.name ?? `정류장 번호 ${id} (이름 확인 불가)`;
  return (
    <li className={selected ? "route-item is-selected" : "route-item"}>
      <p className={totalTime ? "route-time" : "route-time is-unknown"}>
        {totalTime ? (
          <>
            {totalTime.minutes}분<small>{totalTime.estimated ? "추정 포함 · 실시간 예측" : "실시간 예측"}</small>
          </>
        ) : (
          "소요시간 미확인"
        )}
      </p>
      <div className="route-buses">
        <span className="route-badge">{journey.transfers === 0 ? "직행" : `환승 ${journey.transfers}회`}</span>
        {journey.legs.map((l, i) => (
          <span key={`${l.routeId}-${i}`} className="route-leg">
            {i > 0 && (
              <span className="bus-arrow" aria-label="환승">
                →
              </span>
            )}
            <span className="bus-pill">{routesById.get(l.routeId)?.name ?? `노선 ${l.routeId}`}</span>
          </span>
        ))}
      </div>
      <p className="route-meta">
        {name(first.boardStopId)} 승차 · {name(last.alightStopId)} 하차
      </p>
      <p className="route-meta">
        걷기(직선) 출발 {formatDistance(journey.originWalkMeters)} · 도착 {formatDistance(journey.destinationWalkMeters)}
      </p>
      <button type="button" className="link-button" aria-expanded={selected} onClick={() => onSelectJourney(selected ? null : journey.id)}>
        {selected ? "상세 닫기" : "상세 안내·지도 표시 ›"}
      </button>
      {selected && (
        <>
          <ul className="route-explain">
            {explainJourney(ranked, section).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <StepList steps={journeySteps(journey, stopsById, routesById)} />
        </>
      )}
    </li>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  let number = 0;
  return (
    <ol className="route-steps">
      {steps.map((step, i) => {
        switch (step.kind) {
          case "walk_to_board":
            return <li key={i}>출발지에서 {stopLabel(step.to)}까지 걷기 (직선 {formatDistance(step.meters)})</li>;
          case "board":
            if (i === 1) number++;
            return (
              <li key={i} className="is-bus">
                {i === 1 && <span className="route-step-num">{number}</span>}
                {stopLabel(step.stop)}에서 {step.routeName ?? `노선 ${step.routeId}`} 승차
                {step.towards && ` (${stopLabel(step.towards)} 방면)`} — {step.stopsToRide}개 정류장 이동
              </li>
            );
          case "transfer":
            number++;
            return (
              <li key={i} className="is-bus">
                <span className="route-step-num">{number}</span>
                {stopLabel(step.stop)}에서 내려 같은 정류장에서 환승
              </li>
            );
          case "alight":
            number++;
            return (
              <li key={i} className="is-bus">
                <span className="route-step-num">{number}</span>
                {stopLabel(step.stop)}에서 하차
              </li>
            );
          case "walk_to_destination":
            return <li key={i}>{stopLabel(step.from)}에서 목적지까지 걷기 (직선 {formatDistance(step.meters)})</li>;
        }
      })}
    </ol>
  );
}

// 경로 비교(US-004): 총 소요시간·환승·도보를 나란히. 값이 없으면 "미확인"
function CompareTable({ rows, routesById }: { rows: RankedJourney[]; routesById: ReadonlyMap<RouteId, Route> }) {
  if (rows.length < 2) return null;
  return (
    <div className="route-table-wrap">
      <table className="route-compare">
        <caption className="route-note">경로 비교</caption>
        <thead>
          <tr>
            <th scope="col">경로</th>
            <th scope="col">총 소요시간</th>
            <th scope="col">환승</th>
            <th scope="col">걷는 시간</th>
            <th scope="col">걷는 거리(직선)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.journey.id}>
              <th scope="row">{routeLabel(routesById, r.journey)}</th>
              <td>{r.totalTime ? `${r.totalTime.minutes}분${r.totalTime.estimated ? "(추정)" : ""}` : "미확인"}</td>
              <td>{r.journey.transfers}회</td>
              <td>{r.walkMinutes !== null ? `${r.walkMinutes}분` : "미확인"}</td>
              <td>{r.walkMeters !== null ? formatDistance(r.walkMeters) : "미확인"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
