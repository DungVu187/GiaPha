import type { MemberStats } from "./member-types";

export function introLine(parents: { father: string | null; mother: string | null } | null, stats: MemberStats): string {
  const total = `Gia phả hiện có ${stats.memberCount} thành viên qua ${stats.generations.length} đời.`;
  const f = parents?.father;
  const m = parents?.mother;
  const of = f && m ? `Con ông ${f} và bà ${m}.` : f ? `Con ông ${f}.` : m ? `Con bà ${m}.` : "";
  return of ? `${of} ${total}` : total;
}
