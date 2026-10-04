import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import type { MemberSummary } from "@/lib/member-types";

export function RelationCard({ member, subtitle }: { member: MemberSummary; subtitle: string }) {
  return (
    <Link
      href={`/members/${member.id}`}
      className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:bg-primary-soft focus-visible:bg-primary-soft"
    >
      <MemberAvatar fullName={member.fullName} avatarPath={member.avatarPath} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-primary">{member.fullName}</span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </Link>
  );
}
