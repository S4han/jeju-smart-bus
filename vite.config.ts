import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fetchSnapshot } from "./server/snapshot-build";
import { SNAPSHOT_PATH } from "./shared/sources";

// 정류장·노선 스냅샷을 빌드 결과에 정적 파일로 넣는다(D-01, D-10 (A) 승인 2026-10-26).
// Vercel 빌드(VERCEL=1)나 SNAPSHOT_FETCH=1일 때만 상류를 호출한다. 그 밖의 로컬 빌드는 스냅샷 없이 만든다(화면은 "불러오지 못함").
function transitSnapshot(): Plugin {
  return {
    name: "transit-snapshot",
    apply: "build",
    async generateBundle() {
      if (process.env.VERCEL !== "1" && process.env.SNAPSHOT_FETCH !== "1") {
        this.warn("정류장 스냅샷 생략(VERCEL·SNAPSHOT_FETCH 아님)");
        return;
      }
      const { snapshot, stats } = await fetchSnapshot();
      this.emitFile({ type: "asset", fileName: SNAPSHOT_PATH, source: JSON.stringify(snapshot) });
      this.info(`정류장 스냅샷: 정류장 ${stats.stops.included}·노선 ${stats.routes.included}·원천 갱신 ${snapshot.sourceUpdatedAt ?? "없음"}`);
      // 방향·노선 번호 데이터 품질(TASK-030 검증용, 공개 데이터 집계만)
      const dirs: Record<string, number> = {};
      for (const st of snapshot.stops) dirs[st.direction ?? "없음"] = (dirs[st.direction ?? "없음"] ?? 0) + 1;
      const withNumber = snapshot.routes.filter((r) => r.number);
      const prefixMatch = withNumber.filter((r) => r.name === r.number || r.name.startsWith(`${r.number}-`));
      const mismatch = withNumber.filter((r) => !prefixMatch.includes(r)).slice(0, 8).map((r) => `${r.name}→${r.number}`);
      this.info(`스냅샷 품질: 방향 ${JSON.stringify(dirs)} · 노선번호 ${withNumber.length}/${snapshot.routes.length} · 이름 앞부분 일치 ${prefixMatch.length} · 불일치 예 ${mismatch.join(", ") || "없음"}`);
    },
  };
}

export default defineConfig({ plugins: [react(), transitSnapshot()] });
