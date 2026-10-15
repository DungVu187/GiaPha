"use client";

import { Handle, Position, useStore, type Node, type NodeProps } from "@xyflow/react";
import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { formatAnniversaryShort, formatPartialDate } from "@/lib/format";
import { CARD_GAP, CARD_W, FAMILY_PAD, spouseRole, type LaidFamily } from "@/lib/tree-layout";
import type { TreeCard, TreeFamily } from "@/lib/tree-types";
import { cn } from "@/lib/utils";

/** Dưới mức zoom này thẻ chỉ còn tên chữ to (nhìn xa vẫn đọc được tên, thấy dáng nhánh). */
export const COMPACT_ZOOM = 0.5;

export type FamilyNodeData = {
  family: TreeFamily;
  laid: LaidFamily;
  highlightId: number | null;
  onToggle: (familyId: number) => void;
};
export type FamilyFlowNode = Node<FamilyNodeData, "family">;

function Sub({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("w-full truncate text-[13px] leading-[18px]", className)}>{children}</span>;
}

// Các dòng phải khớp cardLines() trong tree-layout.ts (chiều cao thẻ tính trước).
function Card({ c, spouseOf, highlight, height, compact }: { c: TreeCard; spouseOf: string | null; highlight: boolean; height: number; compact: boolean }) {
  const kind = spouseOf ? "spouse" : "lineage";
  const birth = formatPartialDate({ year: c.birthYear, month: c.birthMonth, day: c.birthDay });
  const death = formatPartialDate({ year: c.deathYear, month: c.deathMonth, day: c.deathDay });
  const anniversary =
    c.anniversaryDay !== null && c.anniversaryMonth !== null && c.anniversaryCalendar !== null
      ? formatAnniversaryShort(c.anniversaryDay, c.anniversaryMonth, c.anniversaryCalendar)
      : null;
  return (
    <Link
      href={`/members/${c.id}`}
      data-member-id={c.id}
      data-kind={kind}
      data-highlight={highlight}
      style={{ width: CARD_W, height }}
      className={cn(
        "flex flex-col items-center gap-1 overflow-hidden rounded-md border border-t-4 border-border px-3 py-3 text-center shadow-sm transition-shadow hover:shadow-md focus-visible:outline-3 focus-visible:outline-ring",
        kind === "lineage" ? "border-t-primary" : "border-t-accent",
        c.isDeceased ? "bg-muted" : "bg-card",
        highlight && "ring-4 ring-accent",
        compact && "justify-center",
      )}
    >
      {compact ? (
        <>
          <span className="line-clamp-3 font-heading text-[26px] leading-8 font-bold">{c.fullName}</span>
          <span className="text-lg text-accent-text">Đời {c.generation}</span>
        </>
      ) : (
        <>
          <MemberAvatar fullName={c.fullName} avatarPath={c.avatarPath} size="sm" alt="" />
          <span className="line-clamp-2 min-h-11 font-heading text-[17px] leading-[22px] font-semibold">{c.fullName}</span>
          <span className="flex h-[22px] items-center gap-1.5 text-[13px] text-accent-text">
            Đời {c.generation}
            {c.isDeceased && <span className="rounded bg-foreground px-1.5 text-xs leading-5 font-bold text-background">ĐÃ KHUẤT</span>}
          </span>
          {spouseOf && <Sub className="text-accent-text">{spouseOf}</Sub>}
          {birth && <Sub className="text-muted-foreground">Sinh: {birth}</Sub>}
          {c.isDeceased && death && <Sub>Mất: {death}</Sub>}
          {c.isDeceased && anniversary && <Sub className="text-primary">Giỗ: {anniversary}</Sub>}
          {c.isDeceased && c.burialPlace && <Sub className="text-muted-foreground">An táng: {c.burialPlace}</Sub>}
        </>
      )}
    </Link>
  );
}

export function FamilyNode({ data }: NodeProps<FamilyFlowNode>) {
  const { family, laid, highlightId, onToggle } = data;
  // Chỉ render lại khi vượt ngưỡng, không phải mỗi khung hình zoom.
  const compact = useStore((s) => s.transform[2] < COMPACT_ZOOM);
  const name = family.person.fullName;
  return (
    <div className="relative rounded-lg bg-secondary" style={{ width: laid.width, height: laid.height, padding: FAMILY_PAD }}>
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <div className="flex" style={{ gap: CARD_GAP }}>
        <Card c={family.person} spouseOf={null} highlight={highlightId === family.person.id} height={laid.cardHeight} compact={compact} />
        {family.spouses.map((s) => (
          <Card
            key={s.id}
            c={s}
            spouseOf={`${spouseRole(s.gender)} của ${name}`}
            highlight={highlightId === s.id}
            height={laid.cardHeight}
            compact={compact}
          />
        ))}
      </div>
      {laid.hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(family.id)}
          aria-expanded={!laid.collapsed}
          aria-label={laid.collapsed ? `Mở nhánh của ${name} (${laid.hiddenCount} người)` : `Thu gọn nhánh của ${name}`}
          className={cn(
            "nodrag nopan absolute bottom-0 left-1/2 z-10 h-10 -translate-x-1/2 translate-y-1/2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap shadow-sm",
            laid.collapsed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
          )}
        >
          {laid.collapsed ? `+ ${laid.hiddenCount} người` : "− Thu gọn"}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" isConnectable={false} />
    </div>
  );
}
