const MAX_QUERY = 100;

/** Gom các dòng liên tiếp cùng đời — đầu vào đã xếp theo đời (GET /api/members/directory). */
export function groupByGeneration<T extends { generation: number }>(rows: T[]): { generation: number; members: T[] }[] {
  const groups: { generation: number; members: T[] }[] = [];
  for (const r of rows) {
    const last = groups.at(-1);
    if (last?.generation === r.generation) last.members.push(r);
    else groups.push({ generation: r.generation, members: [r] });
  }
  return groups;
}

type RawParams = { q?: string | string[]; generation?: string | string[] };

export function parseDirectoryParams(sp: RawParams): { q: string; generation: number | null } {
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, MAX_QUERY) : "";
  const g = typeof sp.generation === "string" && /^\d{1,3}$/.test(sp.generation) ? Number(sp.generation) : 0;
  return { q, generation: g >= 1 ? g : null };
}

export function directoryQuery(q: string, generation: number | null): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (generation !== null) p.set("generation", String(generation));
  const s = p.toString();
  return s ? `?${s}` : "";
}
