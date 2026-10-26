// 경로 탐색 시작 조건 안내와 실행 (TASK-015 AC-006·AC-007, TASK-016 AC-008·AC-009·AC-016)
// 결과의 소요시간·추천 정렬·상세 안내는 TASK-017·018에서 붙인다. 여기서는 검증된 연결 수와 "경로 없음" 사유만 보여 준다
import { ENDPOINT_LABEL, type EndpointKey, type RouteReadiness } from "./candidates";
import type { SearchResult } from "./engine";

const names = (keys: EndpointKey[]) => keys.map((k) => ENDPOINT_LABEL[k]).join("·");

interface RouteReadinessNoticeProps {
  readiness: RouteReadiness;
  canSearch: boolean;
  onSearch: () => void;
  result: SearchResult | null;
}

export function RouteReadinessNotice({ readiness, canSearch, onSearch, result }: RouteReadinessNoticeProps) {
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
        {result && <SearchSummary result={result} />}
      </div>
      <button type="button" className="route-search-button" disabled={!canSearch} onClick={onSearch}>
        경로 찾기
      </button>
    </section>
  );
}

function SearchSummary({ result }: { result: SearchResult }) {
  if (result.status === "empty") {
    return (
      <p className="route-result">
        {result.reason === "no_route"
          ? "검색 가능한 경로가 없습니다. 같은 정류장에서 갈아타는 환승 2회 이내 버스 경로를 찾지 못했습니다."
          : "노선 데이터를 확인할 수 없어 경로를 판단하지 못했습니다."}
      </p>
    );
  }
  const count = (t: number) => result.journeys.filter((j) => j.transfers === t).length;
  return (
    <p className="route-result">
      검증된 연결 경로: 직행 {count(0)}개 · 1회 환승 {count(1)}개 · 2회 환승 {count(2)}개. 소요시간·추천 순서와 상세 안내는 준비
      중입니다.
    </p>
  );
}
