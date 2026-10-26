// 경로 탐색 시작 조건 안내와 실행 (TASK-015 AC-006·AC-007, TASK-016 AC-008·AC-009·AC-016)
// 결과: 시간 확인 추천(최대 3)·시간 미확인(최대 5) 두 영역(TASK-017). 구간별 상세 안내는 TASK-018
import type { Route, RouteId, Stop, StopId } from "../../shared/domain";
import { formatDistance } from "../stops/nearby";
import { ENDPOINT_LABEL, type EndpointKey, type RouteReadiness } from "./candidates";
import type { SearchResult } from "./engine";
import { buildResultSections, type RankedJourney } from "./ranking";

const names = (keys: EndpointKey[]) => keys.map((k) => ENDPOINT_LABEL[k]).join("·");

interface RouteReadinessNoticeProps {
  readiness: RouteReadiness;
  canSearch: boolean;
  onSearch: () => void;
  result: SearchResult | null;
  routesById: ReadonlyMap<RouteId, Route>;
  stopsById: ReadonlyMap<StopId, Stop>;
}

export function RouteReadinessNotice({ readiness, canSearch, onSearch, result, routesById, stopsById }: RouteReadinessNoticeProps) {
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
          <ul>
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
        {result && <SearchResults result={result} routesById={routesById} stopsById={stopsById} />}
      </div>
      <button type="button" className="route-search-button" disabled={!canSearch} onClick={onSearch}>
        경로 찾기
      </button>
    </section>
  );
}

interface SearchResultsProps {
  result: SearchResult;
  routesById: ReadonlyMap<RouteId, Route>;
  stopsById: ReadonlyMap<StopId, Stop>;
}

function SearchResults({ result, routesById, stopsById }: SearchResultsProps) {
  if (result.status === "empty") {
    return (
      <p className="route-result">
        {result.reason === "no_route"
          ? "검색 가능한 경로가 없습니다. 같은 정류장에서 갈아타는 환승 2회 이내 버스 경로를 찾지 못했습니다."
          : "노선 데이터를 확인할 수 없어 경로를 판단하지 못했습니다."}
      </p>
    );
  }
  const sections = buildResultSections(result.journeys);
  return (
    <>
      <h3>추천 경로 (소요시간 기준)</h3>
      {sections.recommended.length === 0 ? (
        <p>소요시간을 확인할 수 있는 경로가 없습니다. 대기·버스 이동 시간 자료를 아직 검증하지 못해 시간을 계산하지 않습니다.</p>
      ) : (
        <ol className="route-list">
          {sections.recommended.map((r) => (
            <JourneyItem key={r.journey.id} ranked={r} routesById={routesById} stopsById={stopsById} />
          ))}
        </ol>
      )}
      {sections.timeUnknown.length > 0 && (
        <>
          <h3>소요시간 미확인 경로</h3>
          <p className="route-note">연결이 확인된 경로입니다. 총 소요시간은 확인할 수 없어 표시하지 않습니다. 환승이 적고 걷는 거리가 짧은 순입니다.</p>
          <ol className="route-list">
            {sections.timeUnknown.map((r) => (
              <JourneyItem key={r.journey.id} ranked={r} routesById={routesById} stopsById={stopsById} />
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function JourneyItem({ ranked, routesById, stopsById }: { ranked: RankedJourney } & Omit<SearchResultsProps, "result">) {
  const { journey, totalTime } = ranked;
  const routeName = (id: RouteId) => routesById.get(id)?.name ?? "노선 정보 없음";
  const stopName = (id: StopId) => stopsById.get(id)?.name ?? "정류장 정보 없음";
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  return (
    <li className="route-item">
      <p className="route-item-head">
        <span className="route-badge">{journey.transfers === 0 ? "직행" : `환승 ${journey.transfers}회`}</span>
        {journey.legs.map((l) => routeName(l.routeId)).join(" → ")}
      </p>
      <p className="route-meta">
        승차 {stopName(first.boardStopId)} · 하차 {stopName(last.alightStopId)}
      </p>
      <p className="route-meta">
        {totalTime ? `총 ${totalTime.minutes}분${totalTime.estimated ? " (추정 포함)" : ""}` : "총 소요시간 미확인"} · 걷기(직선) 출발{" "}
        {formatDistance(journey.originWalkMeters)} · 도착 {formatDistance(journey.destinationWalkMeters)}
      </p>
    </li>
  );
}
