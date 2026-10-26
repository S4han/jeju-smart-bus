// 서비스 장애 안내 영역 (TASK-019, AC-017) — 영향 기능과 계속 쓸 수 있는 기능을 함께 알린다
import { describeImpact, type ImpactNotice } from "./impact";

export function ServiceNotices({ notices }: { notices: ImpactNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <section className="service-notices" role="status" aria-label="서비스 상태 안내">
      {notices.map((n) => (
        <p key={`${n.service}-${n.cause}`}>{describeImpact(n)}</p>
      ))}
    </section>
  );
}
