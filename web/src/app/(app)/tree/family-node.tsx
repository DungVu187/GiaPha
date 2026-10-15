"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { cn } from "@/lib/utils";
import { formatAnniversaryShort, formatPartialDate } from "@/lib/format";
import { CARD_GAP, CARD_W, FAMILY_PAD, type LaidFamily } from "@/lib/tree-layout";
import type { TreeCard, TreeFamily } from "@/lib/tree-types";

export type FamilyNodeData = {
  family: TreeFamily;
  laid: LaidFamily;
  highlightId: number | null;
  onToggle: (familyId: number) => void;
};
export type FamilyFlowNode = Node<FamilyNodeData, "family">;

function Card({ c, kind, highlight, height }: { c: TreeCard; kind: "lineage" | "spouse"; highlight: boolean; height: number }) {
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
        "flex flex-col items-center gap-1 rounded-md border border-t-4 border-border px-3 py-3 text-center text-xs shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring",
        kind === "lineage" ? "border-t-primary" : "border-t-accent",
        c.isDeceased ? "bg-muted" : "bg-card",
        highlight && "ring-4 ring-accent",
      )}
    >
      <MemberAvatar fullName={c.fullName} avatarPath={c.avatarPath} size="sm" alt="" />
      <span className="font-heading text-sm leading-tight font-semibold">{c.fullName}</span>
      <span className="flex flex-wrap items-center justify-center gap-1 text-accent-text">
        Đời {c.generation}
        {c.isDeceased && (
          <span className="rounded bg-foreground px-1 text-[10px] font-bold text-background">ĐÃ KHUẤT</span>
        )}
      </span>
      {birth && <span className="text-muted-foreground">Sinh: {birth}</span>}
      {c.isDeceased && death && <span>Mất: {death}</span>}
      {c.isDeceased && anniversary && <span className="text-primary">Giỗ: {anniversary}</span>}
      {c.isDeceased && c.burialPlace && <span className="text-muted-foreground">An táng: {c.burialPlace}</span>}
    </Link>
  );
}

export function FamilyNode({ data }: NodeProps<FamilyFlowNode>) {
  const { family, laid, highlightId, onToggle } = data;
  const name = family.person.fullName;
  return (
    <div className="relative rounded-lg bg-secondary" style={{ width: laid.width, padding: FAMILY_PAD }}>
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      <div className="flex" style={{ gap: CARD_GAP }}>
        <Card c={family.person} kind="lineage" highlight={highlightId === family.person.id} height={laid.cardHeight} />
        {family.spouses.map((s) => (
          <Card key={s.id} c={s} kind="spouse" highlight={highlightId === s.id} height={laid.cardHeight} />
        ))}
      </div>
      {laid.hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(family.id)}
          aria-expanded={!laid.collapsed}
          aria-label={
            laid.collapsed ? `Mở nhánh của ${name} (${laid.hiddenCount} người)` : `Thu gọn nhánh của ${name}`
          }
          className={cn(
            "nodrag nopan absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow-sm",
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
