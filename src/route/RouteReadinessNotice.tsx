// 경로 탐색 시작 조건 안내와 실행 (TASK-015 AC-006·AC-007, TASK-016 AC-008·AC-009·AC-016)
// 결과: 시간 확인 추천(최대 3)·시간 미확인(최대 5) 두 영역(TASK-017), 단계 안내·규칙 설명·비교표(TASK-018 FR-013·018, US-004)
import { useEffect, useMemo, useRef } from "react";
import type { Route, RouteId, Stop, StopId } from "../../shared/domain";
import { formatDistance } from "../stops/nearby";
import { ENDPOINT_LABEL, type EndpointKey, type RouteReadiness } from "./candidates";
import type { SearchResult } from "./engine";
import { buildResultSections, type RankedJourney, type TimeEstimator } from "./ranking";
import type { TimingState } from "./useJourneyTimes";
import { explainJourney } from "./explain";
import { formatClock, formatDuration, routeNumber } from "./display";
import { JourneyDetail } from "./JourneyDetail";

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
  originLabel: string;
  destinationLabel: string;
}

export function RouteReadinessNotice({ readiness, canSearch, onSearch, result, ...rest }: RouteReadinessNoticeProps) {
  return (
    <section className="route-readiness" aria-labelledby="route-readiness-title">
      <h2 id="route-readiness-title">경로 찾기</h2>
      <div aria-live="polite">
        {readiness.ready ? (
          !result && <p>
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
        {result && (
          <div id="route-results" className="route-results">
            <SearchResults result={result} onSearch={onSearch} canSearch={canSearch} {...rest} />
          </div>
        )}
      </div>
      {/* 결과가 나오면 하단 고정 버튼 자리에 결과 요약 막대(SearchResults 안)를 둔다 */}
      {!result && (
        <div className="cta-bar">
          <button type="button" className="route-search-button" disabled={!canSearch} onClick={onSearch}>
            경로 찾기
          </button>
        </div>
      )}
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
  originLabel: string;
  destinationLabel: string;
  onSearch: () => void;
  canSearch: boolean;
}

// 결과(TASK-030): 경로 탭(추천 순서 그대로 — AC-011·AC-015) + 고른 경로 상세 + 하단 요약
function SearchResults({ result, estimator, timing, selectedJourneyId, onSelectJourney, onSearch, canSearch, ...rest }: SearchResultsProps) {
  const sections = result.status === "ok" ? buildResultSections(result.journeys, estimator) : null;
  const shown = sections ? [...sections.recommended, ...sections.timeUnknown] : [];
  // 사용자가 탭을 고르기 전에는 항상 첫 경로(가장 빠른 경로)를 보여 준다 — 실시간 예측이 늦게 와도 따라감
  const picked = useRef(false);
  useEffect(() => {
    picked.current = false;
  }, [result]);
  const firstId = shown[0]?.journey.id ?? null;
  useEffect(() => {
    if (!picked.current && firstId && firstId !== selectedJourneyId) onSelectJourney(firstId);
  }, [firstId, selectedJourneyId, onSelectJourney]);
  const now = useMemo(() => Date.now(), [estimator, result]);

  if (result.status === "empty" || !sections) {
    return (
      <p className="route-result">
        {result.status === "empty" && result.reason === "no_route"
          ? "검색 가능한 경로가 없습니다. 같은 정류장에서 갈아타는 환승 2회 이내 버스 경로를 찾지 못했습니다."
          : "노선 데이터를 확인할 수 없어 경로를 판단하지 못했습니다."}
      </p>
    );
  }
  const selected = shown.find((r) => r.journey.id === selectedJourneyId) ?? shown[0];
  const labelOf = (r: RankedJourney) => {
    const i = sections.recommended.indexOf(r);
    return i === 0 ? "가장 빠른 경로" : i > 0 ? `추천 ${i + 1}` : `경로 ${shown.indexOf(r) + 1}`;
  };
  const routeText = (r: RankedJourney) =>
    r.journey.legs.map((l) => routeNumber(rest.routesById.get(l.routeId), l.routeId)).join(" → ");

  return (
    <>
      {timing.status === "loading" && <p className="route-note">버스 실시간 예측을 불러오는 중입니다…</p>}
      {timing.status === "ready" && sections.recommended.length === 0 && (
        <p className="route-note">지금 실시간 예측으로 소요시간을 계산할 수 있는 경로가 없습니다(제때 탈 수 있는 차량의 도착 예측이 경로와 이어지지 않음).</p>
      )}
      {timing.status === "ready" && timing.failedRoutes > 0 && (
        <p className="route-note">일부 노선({timing.failedRoutes}개)의 실시간 예측을 불러오지 못해 해당 경로는 소요시간 미확인으로 두었습니다.</p>
      )}
      <div className="journey-tabs" role="tablist" aria-label="경로 선택">
        {shown.map((r) => {
          const on = r === selected;
          return (
            <button
              key={r.journey.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? "journey-tab is-selected" : "journey-tab"}
              onClick={() => {
                picked.current = true;
                onSelectJourney(r.journey.id);
              }}
            >
              <span className="journey-tab-label">{labelOf(r)}</span>
              <span className="journey-tab-time">{r.totalTime ? formatDuration(r.totalTime.minutes) : "시간 미확인"}</span>
              <span className="journey-tab-routes">
                {r.journey.transfers === 0 ? "직행" : `환승 ${r.journey.transfers}회`} · {routeText(r)}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <JourneyDetail
          ranked={selected}
          label={labelOf(selected)}
          routesById={rest.routesById}
          stopsById={rest.stopsById}
          originLabel={rest.originLabel}
          destinationLabel={rest.destinationLabel}
          now={now}
          estimator={estimator}
        >
          <Explanation lines={explainJourney(selected, sections.recommended.includes(selected) ? "recommended" : "time_unknown")} />
        </JourneyDetail>
      )}
      <p className="route-note">
        시간은 버스 실시간 예측(제주 버스정보시스템)과 걷는 시간 추정(직선거리 기준)으로 계산합니다. 예측은 몇 분씩 바뀔 수 있습니다. 지도에는 실제 도로 경로가 없어 선을 그리지 않습니다.
      </p>
      {shown.length >= 2 && (
        <details className="route-more">
          <summary>경로 비교표 보기</summary>
          <CompareTable rows={shown} routesById={rest.routesById} />
        </details>
      )}
      {/* 하단 요약(네이버·카카오처럼): 고른 경로의 총 소요시간·도착 예정 + 다시 찾기 */}
      <div className="cta-bar result-bar">
        <p className="result-bar-summary">
          {selected?.totalTime ? (
            <>
              <strong>{formatDuration(selected.totalTime.minutes)}</strong>
              <span>{formatClock(now + selected.totalTime.minutes * 60_000)} 도착 예정</span>
            </>
          ) : (
            <strong>소요시간 미확인</strong>
          )}
        </p>
        <button type="button" className="btn btn-secondary" disabled={!canSearch} onClick={onSearch}>
          다시 찾기
        </button>
      </div>
    </>
  );
}

function Explanation({ lines }: { lines: string[] }) {
  const [head, ...more] = lines;
  if (!head) return null;
  return (
    <div className="route-explain">
      <p className="route-explain-head">{head}</p>
      {more.length > 0 && (
        <details>
          <summary>추천 근거 자세히</summary>
          <ul>
            {more.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const routeLabel = (routesById: ReadonlyMap<RouteId, Route>, j: RankedJourney["journey"]) =>
  j.legs.map((l) => routeNumber(routesById.get(l.routeId), l.routeId)).join(" → ");

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
