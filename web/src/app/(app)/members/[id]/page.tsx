import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberAvatar } from "@/components/member-avatar";
import { RelationCard } from "@/components/relation-card";
import { buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import {
  formatAnniversaryLong,
  formatDaysLeft,
  formatDeathDate,
  formatPartialDate,
  genderLabel,
  spouseLabel,
} from "@/lib/format";
import type { MemberDetail, MemberSummary } from "@/lib/member-types";
import { AvatarUpload } from "./avatar-upload";
import { DeleteButton } from "./delete-button";
import { RelativeDialog } from "./relative-dialog";
import { RemoveSpouseButton } from "./remove-spouse-button";

const sub = (m: MemberSummary) => `Đời ${m.generation}${m.isDeceased ? ", đã khuất" : ""}`;
const pad2 = (n: number) => String(n).padStart(2, "0");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-(--shadow-card)">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-muted-foreground sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">{title}</h3>
      {empty ? <p className="text-muted-foreground">Chưa có</p> : children}
    </div>
  );
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const m = await apiGet<MemberDetail>(`/api/members/${id}`);
  if (!m) notFound();
  const isAdmin = (await getCurrentUser())?.role === "ADMIN";
  const canEdit = m.permissions.canEdit;
  const spouses = m.spouses.map((s) => ({ id: s.id, fullName: s.fullName }));

  const parent = m.father ? { label: "ông", p: m.father } : m.mother ? { label: "bà", p: m.mother } : null;
  const birth = formatPartialDate({ year: m.birthYear, month: m.birthMonth, day: m.birthDay });
  const next = m.nextAnniversary;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Đường dẫn" className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Link href="/members" className="text-primary hover:underline">
          Thành viên
        </Link>
        <span aria-hidden="true">›</span>
        <span>Đời {m.generation}</span>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{m.fullName}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-(--shadow-card) sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-2">
              <MemberAvatar fullName={m.fullName} avatarPath={m.avatarPath} size="lg" />
              {canEdit && <AvatarUpload memberId={m.id} hasAvatar={m.avatarPath !== null} />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h1 className="font-heading text-2xl leading-8 font-semibold">{m.fullName}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-0.5 text-sm font-bold text-primary">Đời {m.generation}</span>
                {m.isDeceased && (
                  <span className="rounded-full bg-foreground px-3 py-0.5 text-sm font-bold text-background">ĐÃ KHUẤT</span>
                )}
              </div>
              {parent && (
                <p className="text-muted-foreground">
                  Con của {parent.label} {parent.p.fullName}
                </p>
              )}
              {(m.permissions.canEdit || m.permissions.canDelete) && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {m.permissions.canEdit && (
                    <Link href={`/members/${m.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                      Sửa thông tin
                    </Link>
                  )}
                  {m.permissions.canDelete && <DeleteButton id={m.id} fullName={m.fullName} />}
                </div>
              )}
            </div>
          </section>

          <Section title="Thông tin">
            <dl className="flex flex-col gap-2">
              <Row label="Giới tính">{genderLabel(m.gender)}</Row>
              <Row label="Ngày sinh">{birth || "Chưa rõ"}</Row>
              {m.birthOrder !== null && <Row label="Thứ tự trong anh chị em">{m.birthOrder}</Row>}
            </dl>
          </Section>

          {m.isDeceased && (
            <section className="flex flex-col gap-3 rounded-xl border-l-4 border-foreground bg-muted p-5">
              <div>
                <h2 className="font-bold tracking-wide">ĐÃ KHUẤT</h2>
                <p className="text-sm text-muted-foreground">Ngày mất, ngày giỗ, nơi an táng</p>
              </div>
              <dl className="flex flex-col gap-2">
                <Row label="Ngày mất">{formatDeathDate(m) || "Chưa rõ"}</Row>
                <Row label="Ngày giỗ">
                  {m.anniversaryDay !== null && m.anniversaryMonth !== null && m.anniversaryCalendar !== null
                    ? formatAnniversaryLong(m.anniversaryDay, m.anniversaryMonth, m.anniversaryCalendar)
                    : "Chưa rõ"}
                  {next && (
                    <span className="block text-sm font-normal text-muted-foreground">
                      Giỗ tới: {pad2(next.date.day)}/{pad2(next.date.month)}/{next.date.year} — {formatDaysLeft(next.daysLeft)}
                    </span>
                  )}
                </Row>
                {m.burialPlace && <Row label="Nơi an táng">{m.burialPlace}</Row>}
              </dl>
            </section>
          )}

          {m.note && (
            <Section title="Ghi chú">
              <p className="whitespace-pre-line">{m.note}</p>
            </Section>
          )}
        </div>

        <Section title="Quan hệ gia đình">
          <Group title="Bố" empty={!m.father}>
            {m.father && <RelationCard member={m.father} subtitle={sub(m.father)} />}
          </Group>
          <Group title="Mẹ" empty={!m.mother}>
            {m.mother && <RelationCard member={m.mother} subtitle={sub(m.mother)} />}
          </Group>
          <Group title={spouseLabel(m.gender)} empty={m.spouses.length === 0}>
            {m.spouses.map((s) => (
              <div key={s.marriageId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <RelationCard member={s} subtitle={sub(s)} />
                </div>
                {canEdit && (
                  <RemoveSpouseButton memberId={m.id} fullName={m.fullName} spouseId={s.id} spouseName={s.fullName} />
                )}
              </div>
            ))}
          </Group>
          <Group title={`Con (${m.children.length})`} empty={m.children.length === 0}>
            {m.children.map((c) => (
              <RelationCard key={c.id} member={c} subtitle={sub(c)} />
            ))}
          </Group>
          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-2">
              {(["FATHER", "MOTHER", "SPOUSE", "CHILD"] as const)
                .filter((r) => (r === "FATHER" ? !m.father : r === "MOTHER" ? !m.mother : true))
                .map((r) => (
                  <RelativeDialog
                    key={r}
                    memberId={m.id}
                    personGender={m.gender}
                    relation={r}
                    canPickExisting={isAdmin}
                    spouses={spouses}
                  />
                ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
