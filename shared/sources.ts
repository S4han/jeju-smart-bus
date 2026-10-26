// 데이터 접근 인터페이스 (TASK-009, D-01)
// 정류장·노선은 정적 스냅샷, 도착정보는 서버 프록시(정류장 ID만 전송)에서 가져온다.
// 실제 구현: 스냅샷은 src/data/httpSnapshotSource.ts, 도착정보는 src/data/httpArrivalSource.ts(조회 시점 나이 포함 — TASK-014).
// 아래 ArrivalSource·고정 소스는 초기 계약으로 테스트에만 쓰인다.

import type { TransitSnapshot } from "./bis-convert.js";
import { failure, ok, type Arrival, type Result, type StopId } from "./domain.js";

// 정적 스냅샷의 배포 경로(빌드 결과 dist 기준). 형식이 바뀌면 파일명 버전을 올린다
export const SNAPSHOT_PATH = "data/transit-snapshot.v1.json";

export interface SnapshotSource {
  loadSnapshot(): Promise<Result<TransitSnapshot>>;
}

export interface ArrivalSource {
  getArrivals(stopId: StopId): Promise<Result<Arrival[]>>;
}

// 테스트·개발용 고정 데이터 소스. 등록되지 않은 정류장은 "empty"로 답한다(데이터를 만들지 않음)
export function createStaticSources(
  snapshot: TransitSnapshot | null,
  arrivalsByStop: Record<StopId, Arrival[]> = {},
): SnapshotSource & ArrivalSource {
  return {
    async loadSnapshot() {
      return snapshot ? ok(snapshot) : failure("unavailable", "snapshot_missing");
    },
    async getArrivals(stopId) {
      const arrivals = arrivalsByStop[stopId];
      return arrivals && arrivals.length > 0 ? ok(arrivals) : failure("empty");
    },
  };
}
