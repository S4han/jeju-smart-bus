// 경로 탐색 시작 조건 안내 (TASK-015, AC-006·AC-007). 탐색 실행은 TASK-016
import { ENDPOINT_LABEL, type EndpointKey, type RouteReadiness } from "./candidates";

const names = (keys: EndpointKey[]) => keys.map((k) => ENDPOINT_LABEL[k]).join("·");

export function RouteReadinessNotice({ readiness }: { readiness: RouteReadiness }) {
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
      </div>
    </section>
  );
}
