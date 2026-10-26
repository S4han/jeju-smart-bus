// 제주 BIS XML 응답 요약 (TASK-005 검증용, 의존성 없음)
// 명세 예제가 부정확하므로(BIS-API-spec-summary.md §4) 태그 이름을 가정하지 않고 구조를 관찰한다.

export type XmlRecord = Record<string, string>;

const ELEMENT = /<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;

function textOf(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return (cdata ? cdata[1] : raw).trim();
}

export function firstTag(xml: string, name: string): string | undefined {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`));
  return m ? textOf(m[1]) : undefined;
}

export interface ItemsBlock {
  itemTag: string | null;
  records: XmlRecord[];
}

export function extractItems(xml: string): ItemsBlock {
  const items = xml.match(/<items(?:\s[^>]*)?>([\s\S]*?)<\/items\s*>/);
  if (!items) return { itemTag: null, records: [] };
  const records: XmlRecord[] = [];
  let itemTag: string | null = null;
  for (const m of items[1].matchAll(ELEMENT)) {
    itemTag ??= m[1];
    const record: XmlRecord = {};
    for (const f of m[2].matchAll(ELEMENT)) record[f[1]] = textOf(f[2]);
    records.push(record);
  }
  return { itemTag, records };
}

export interface NumericRange {
  present: number;
  missingOrEmpty: number;
  nonNumeric: number;
  zero: number;
  min: number | null;
  max: number | null;
}

export function numericRange(records: XmlRecord[], field: string): NumericRange {
  const range: NumericRange = { present: 0, missingOrEmpty: 0, nonNumeric: 0, zero: 0, min: null, max: null };
  for (const r of records) {
    const raw = r[field];
    if (raw === undefined || raw === "" || raw === "null") {
      range.missingOrEmpty++;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      range.nonNumeric++;
      continue;
    }
    range.present++;
    if (n === 0) range.zero++;
    range.min = range.min === null ? n : Math.min(range.min, n);
    range.max = range.max === null ? n : Math.max(range.max, n);
  }
  return range;
}

export function distinctValues(records: XmlRecord[], field: string, limit = 20): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const v = r[field] ?? "(없음)";
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit));
}

export function fieldNames(records: XmlRecord[]): string[] {
  return [...new Set(records.flatMap((r) => Object.keys(r)))].sort();
}
