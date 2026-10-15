"use client";

import { ChevronDown, ChevronRight, Network, UserRound } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { DeceasedBadge } from "@/components/deceased-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { spouseLabel } from "@/lib/format";
import { branchRows, type BranchRow } from "@/lib/tree-branches";
import { ancestorFamilyIds, familyIdOf } from "@/lib/tree-layout";
import type { TreeCard, TreeData } from "@/lib/tree-types";
import { cn } from "@/lib/utils";
import { TreeSearchPanel } from "./tree-search-panel";

const INDENT = 24;
const MAX_INDENT_LEVEL = 8; // điện thoại: không thụt quá sâu

function PersonLink({ c, highlight, className }: { c: TreeCard; highlight: boolean; className?: string }) {
  return (
    <Link
      href={`/members/${c.id}`}
      data-row-member={c.id}
      data-highlight={highlight}
      className={cn("rounded-sm underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-ring", highlight && "bg-accent/25 ring-2 ring-accent", className)}
    >
      {c.fullName}
    </Link>
  );
}

function Row({ row, highlightId, onToggle }: { row: BranchRow; highlightId: number | null; onToggle: (id: number) => void }) {
  const f = row.family;
  const p = f.person;
  return (
    <li className="border-t border-border first:border-t-0" style={{ paddingLeft: 12 + Math.min(row.depth, MAX_INDENT_LEVEL) * INDENT }}>
      <div className="flex items-start gap-2 py-2 pr-3">
        {f.childIds.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(f.id)}
            aria-expanded={!row.collapsed}
            aria-label={row.collapsed ? `Mở nhánh của ${p.fullName} (${row.hiddenCount} người)` : `Thu gọn nhánh của ${p.fullName}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            {row.collapsed ? <ChevronRight aria-hidden="true" className="size-5" /> : <ChevronDown aria-hidden="true" className="size-5" />}
          </button>
        ) : (
          <span aria-hidden="true" className="size-10 shrink-0" />
        )}
        <div className="flex min-w-0 flex-col gap-1 py-1.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PersonLink c={p} highlight={highlightId === p.id} className="font-heading text-[17px] font-semibold" />
            <span className="text-sm text-accent-text">Đời {p.generation}</span>
            {p.isDeceased && <DeceasedBadge />}
            {row.collapsed && <span className="text-sm font-semibold text-primary">+ {row.hiddenCount} người</span>}
          </span>
          {f.spouses.length > 0 && (
            <span className="text-[15px] text-muted-foreground">
              {spouseLabel(p.gender)}:{" "}
              {f.spouses.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && ", "}
                  <PersonLink c={s} highlight={highlightId === s.id} className="text-foreground" />
                </Fragment>
              ))}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function BranchList({ data, myMemberId }: { data: TreeData; myMemberId: number | null }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const rows = useMemo(() => branchRows(data, collapsed), [data, collapsed]);
  const myFamily = myMemberId !== null ? familyIdOf(data, myMemberId) : null;

  function toggle(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Mở nhánh tổ tiên → cuộn tới dòng → focus link người đó.
  function focusMember(memberId: number) {
    const fid = familyIdOf(data, memberId);
    if (fid === null) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const a of ancestorFamilyIds(data, fid)) next.delete(a);
      return next;
    });
    setHighlightId(memberId);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-row-member="${memberId}"]`);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl leading-10 font-semibold">Cây gia phả — dạng danh sách</h1>
          <p className="text-muted-foreground">
            Theo nhánh: ông → con → cháu. Có người trong dòng họ và vợ/chồng; không có con của con gái (nhánh ngoại).
          </p>
        </div>
        <Link href="/tree" className={buttonVariants({ variant: "outline" })}>
          <Network aria-hidden="true" /> Xem dạng cây
        </Link>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <TreeSearchPanel data={data} highlightId={highlightId} onPick={focusMember} className="w-full sm:max-w-md" />
        {myFamily !== null && myMemberId !== null && (
          <Button variant="outline" onClick={() => focusMember(myMemberId)}>
            <UserRound aria-hidden="true" className="size-4" /> Về hồ sơ của tôi
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Chưa có ai trên cây gia phả.</p>
      ) : (
        <ul aria-label="Cây gia phả theo nhánh" className="flex flex-col rounded-lg border border-border bg-card">
          {rows.map((r) => (
            <Row key={r.family.id} row={r} highlightId={highlightId} onToggle={toggle} />
          ))}
        </ul>
      )}
    </div>
  );
}
