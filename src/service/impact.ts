// 외부 서비스 장애 영향 안내 (TASK-019, FR-017, AC-017, US-007)
// 기능별 의존성 지도: 어떤 서비스가 멈추면 어떤 기능이 안 되고 무엇은 계속 되는지. 대체 결과는 만들지 않는다.

export type Service = "naver_maps" | "snapshot" | "bus_arrivals";
export type Feature = "map" | "map_pick" | "stop_search" | "nearby" | "route_search" | "arrivals";
export type Cause = "unavailable" | "rate_limited" | "quota_exhausted" | "inconsistent";

export const FEATURE_LABEL: Record<Feature, string> = {
  map: "지도 보기",
  map_pick: "지도에서 위치 고르기",
  stop_search: "정류장 이름 검색",
  nearby: "주변 정류장",
  route_search: "경로 찾기",
  arrivals: "실시간 도착정보",
};

const ALL: Feature[] = ["map", "map_pick", "stop_search", "nearby", "route_search", "arrivals"];

// 의존성: NAVER 지도 SDK(브라우저) / 정류장·노선 스냅샷(정적 파일) / 제주 BIS 도착정보(/api/arrivals)
// 도착정보는 정류장 선택(주변 정류장)과 노선 대조(스냅샷)가 필요하다
export const DEPENDENCIES: Record<Service, Feature[]> = {
  naver_maps: ["map", "map_pick"],
  snapshot: ["stop_search", "nearby", "route_search", "arrivals"],
  bus_arrivals: ["arrivals"],
};

const SERVICE_LABEL: Record<Service, string> = {
  naver_maps: "지도 서비스(NAVER Maps)",
  snapshot: "정류장·노선 자료",
  bus_arrivals: "버스 도착정보 서비스",
};

const CAUSE_TEXT: Record<Cause, string> = {
  unavailable: "에 연결하지 못했습니다",
  rate_limited: "에 요청이 많아 잠시 응답하지 못했습니다",
  quota_exhausted: "의 이용 한도에 도달해 잠시 중단했습니다",
  inconsistent: "의 자료가 맞지 않아 사용하지 않습니다",
};

export interface ImpactNotice {
  service: Service;
  cause: Cause;
  message: string;
  affected: Feature[];
  available: Feature[];
}

export function impactNotice(service: Service, cause: Cause, alsoDown: ReadonlyArray<Service> = []): ImpactNotice {
  const affected = DEPENDENCIES[service];
  const down = new Set([service, ...alsoDown].flatMap((s) => DEPENDENCIES[s]));
  return {
    service,
    cause,
    message: `${SERVICE_LABEL[service]}${CAUSE_TEXT[cause]}.`,
    affected,
    available: ALL.filter((f) => !down.has(f)),
  };
}

export function describeImpact(n: ImpactNotice): string {
  const list = (fs: Feature[]) => fs.map((f) => FEATURE_LABEL[f]).join(", ");
  const tail = n.available.length > 0 ? ` 계속 이용할 수 있는 기능: ${list(n.available)}.` : "";
  return `${n.message} 이용할 수 없는 기능: ${list(n.affected)}.${tail}`;
}
