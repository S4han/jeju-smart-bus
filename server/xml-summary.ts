// 제주 BIS XML 응답 읽기 (의존성 없음) — 도착정보 프록시·스냅샷 생성에서 사용
// 명세 예제가 부정확하므로(BIS-API-spec-summary.md §4) 태그 이름을 가정하지 않고 `<items>` 아래 구조를 그대로 읽는다.

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
