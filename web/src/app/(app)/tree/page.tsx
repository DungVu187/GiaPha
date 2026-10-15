import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/current-user";
import type { TreeData } from "@/lib/tree-types";
import { TreeView } from "./tree-view";

// Khung toàn màn hình giữa header và thanh tab đáy (biến --header-h / --tabbar-h ở layout.tsx).
export default async function TreePage({ searchParams }: { searchParams: Promise<{ focus?: string | string[] }> }) {
  const user = await requireUser();
  const data = (await apiGet<TreeData>("/api/tree")) ?? { families: [], roots: [] };
  const raw = (await searchParams).focus;
  const focus = typeof raw === "string" && /^\d{1,10}$/.test(raw) ? Number(raw) : null;
  return (
    <div data-testid="tree-frame" className="fixed inset-x-0 top-(--header-h) bottom-(--tabbar-h) bg-background">
      <h1 className="sr-only">Cây gia phả</h1>
      <TreeView key={focus ?? "none"} data={data} myMemberId={user.memberId} focusId={focus} />
    </div>
  );
}
