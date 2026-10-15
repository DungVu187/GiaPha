import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/current-user";
import { directoryQuery, parseDirectoryParams } from "@/lib/directory";
import type { MemberStats, SearchResult } from "@/lib/member-types";
import { MemberDirectory } from "./member-directory";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; generation?: string | string[] }>;
}) {
  const user = await requireUser();
  const { q, generation } = parseDirectoryParams(await searchParams);
  const [stats, rows] = await Promise.all([
    apiGet<MemberStats>("/api/members/stats"),
    apiGet<SearchResult[]>(`/api/members/directory${directoryQuery(q, generation)}`),
  ]);
  const { memberCount, generations } = stats ?? { memberCount: 0, generations: [] };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl leading-10 font-semibold">Thành viên</h1>
          <p className="text-muted-foreground">
            {memberCount} thành viên qua {generations.length} đời
          </p>
        </div>
        {user.role === "ADMIN" && (
          <Link href="/members/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Thêm thành viên
          </Link>
        )}
      </div>
      <MemberDirectory
        key={`${q}|${generation}`}
        generations={generations}
        initialQuery={q}
        initialGeneration={generation}
        initialRows={rows ?? []}
      />
    </div>
  );
}
