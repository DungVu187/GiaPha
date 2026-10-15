import { toSearchName } from "./name";

export type Segment = { text: string; hit: boolean };

// Bỏ dấu từng ký tự (giống toSearchName nhưng không trim) để vị trí khớp trùng vị trí chữ gốc.
const foldChar = (c: string) =>
  c.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Tách `text` thành các đoạn khớp / không khớp với `query` (so không dấu). */
export function highlightMatches(text: string, query: string): Segment[] {
  const q = toSearchName(query);
  const chars = [...text];
  const folded = chars.map(foldChar);
  // Chữ dạng tổ hợp (một dấu = một ký tự riêng) → vị trí lệch, không tô.
  if (!q || folded.some((f) => f.length !== 1)) return [{ text, hit: false }];
  const hay = folded.join("");
  const hit = new Array<boolean>(chars.length).fill(false);
  for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + q.length)) hit.fill(true, i, i + q.length);
  const out: Segment[] = [];
  chars.forEach((c, i) => {
    const last = out.at(-1);
    if (last && last.hit === hit[i]) last.text += c;
    else out.push({ text: c, hit: hit[i] });
  });
  return out;
}
