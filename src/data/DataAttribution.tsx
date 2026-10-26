// 데이터 출처 표시 (D-10 (A): 공공데이터포털 "이용허락범위 제한 없음" — 출처 표시)

export const DATA_SOURCE_LABEL = "제주특별자치도 버스정보시스템 (공공데이터포털)";

export function formatSnapshotDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DataAttribution({ generatedAt }: { generatedAt: string | null }) {
  const date = generatedAt ? formatSnapshotDate(generatedAt) : null;
  return (
    <footer className="data-attribution">
      <p>
        정류장·노선 자료: {DATA_SOURCE_LABEL}
        {date && <> · {date} 기준</>}
      </p>
    </footer>
  );
}
