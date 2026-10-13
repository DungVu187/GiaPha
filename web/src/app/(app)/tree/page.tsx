import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/current-user";
import type { TreeData } from "@/lib/tree-types";
import { TreeView } from "./tree-view";

// Khung toàn màn hình dưới header (mobile 104px, desktop 72px — xem layout.tsx).
export default async function TreePage({ searchParams }: { searchParams: Promise<{ focus?: string | string[] }> }) {
  const user = await requireUser();
  const data = (await apiGet<TreeData>("/api/tree")) ?? { families: [], roots: [] };
  const raw = (await searchParams).focus;
  const focus = typeof raw === "string" && /^\d{1,10}$/.test(raw) ? Number(raw) : null;
  return (
    <div className="fixed inset-x-0 top-[104px] bottom-0 bg-background sm:top-[72px]">
      <h1 className="sr-only">Cây gia phả</h1>
      <TreeView key={focus ?? "none"} data={data} myMemberId={user.memberId} focusId={focus} />
    </div>
  );
}
