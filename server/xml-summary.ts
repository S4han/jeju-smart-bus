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

// 문자열 날짜 필드의 최솟값·최댓값(같은 형식끼리 사전순 비교) — 데이터 신선도 확인용
export function stringRange(records: XmlRecord[], field: string): { min: string | null; max: string | null; empty: number } {
  let min: string | null = null;
  let max: string | null = null;
  let empty = 0;
  for (const r of records) {
    const v = r[field];
    if (!v || v === "null") {
      empty++;
      continue;
    }
    if (min === null || v < min) min = v;
    if (max === null || v > max) max = v;
  }
  return { min, max, empty };
}

// 제주 범위 기준 좌표 품질: 정상 / 경도·위도 뒤바뀜 / 범위 밖 / 누락
const JEJU_LNG = [126.0, 127.1];
const JEJU_LAT = [33.0, 33.7];
const within = (v: number, [lo, hi]: number[]) => v >= lo && v <= hi;

export interface CoordinateQuality {
  valid: number;
  swapped: number;
  outOfRange: number;
  missing: number;
  swappedExamples: string[];
  outOfRangeExamples: string[];
}

export function coordinateQuality(records: XmlRecord[], idField: string): CoordinateQuality {
  const q: CoordinateQuality = { valid: 0, swapped: 0, outOfRange: 0, missing: 0, swappedExamples: [], outOfRangeExamples: [] };
  for (const r of records) {
    const x = Number(r.localX);
    const y = Number(r.localY);
    if (!r.localX || !r.localY || !Number.isFinite(x) || !Number.isFinite(y)) q.missing++;
    else if (within(x, JEJU_LNG) && within(y, JEJU_LAT)) q.valid++;
    else if (within(y, JEJU_LNG) && within(x, JEJU_LAT)) {
      q.swapped++;
      if (q.swappedExamples.length < 5) q.swappedExamples.push(r[idField]);
    } else {
      q.outOfRange++;
      if (q.outOfRangeExamples.length < 5) q.outOfRangeExamples.push(r[idField]);
    }
  }
  return q;
}
