import { CalendarDays, ChevronRight, Network, Search, UserRound, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { AnniversaryRow } from "@/components/anniversary-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet } from "@/lib/api";
import type { AnniversaryList } from "@/lib/anniversary-types";
import { formatToday, within } from "@/lib/anniversary-view";
import { requireUser } from "@/lib/current-user";
import { introLine } from "@/lib/dashboard";
import type { MemberDetail, MemberStats } from "@/lib/member-types";

const DASHBOARD_LIMIT = 8;

function Shortcut({ href, icon: Icon, title, desc }: { href: string; icon: LucideIcon; title: string; desc: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:bg-primary-soft/60 focus-visible:bg-primary-soft/60">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="truncate text-sm text-muted-foreground">{desc}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, gio, me] = await Promise.all([
    apiGet<MemberStats>("/api/members/stats"),
    apiGet<AnniversaryList>("/api/anniversaries"),
    user.memberId !== null ? apiGet<MemberDetail>(`/api/members/${user.memberId}`) : Promise.resolve(null),
  ]);
  const upcoming = within(gio!.items, 30);
  const shown = upcoming.slice(0, DASHBOARD_LIMIT);
  const parents = me ? { father: me.father?.fullName ?? null, mother: me.mother?.fullName ?? null } : null;
  return (
    // Desktop: trái = lời chào + giỗ; phải = ô tìm (ngang hàng lời chào) + lối tắt. Điện thoại: lời chào → tìm → giỗ → lối tắt (M2).
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-10">
      <header className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        <h1 className="font-heading text-4xl leading-tight font-bold text-primary sm:text-5xl">GIA PHẢ HỌ VŨ</h1>
        <div aria-hidden="true" className="hidden items-center gap-2 text-accent sm:flex">
          <span className="h-px w-12 bg-accent" />◆<span className="h-px w-12 bg-accent" />
        </div>
        <h2 className="flex flex-wrap items-center gap-3 font-heading text-2xl font-semibold">
          Xin chào, {user.member?.fullName ?? user.username}
          {user.member && (
            <span className="rounded-md bg-accent/20 px-2 py-0.5 font-sans text-sm font-semibold text-accent-text">
              Đời {user.member.generation}
            </span>
          )}
        </h2>
        <p className="text-muted-foreground">{introLine(parents, stats ?? { memberCount: 0, generations: [] })}</p>
      </header>

      <form action="/members" role="search" className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1 lg:self-end">
        <Label htmlFor="home-search">Tìm thành viên</Label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input id="home-search" name="q" type="search" autoComplete="off" placeholder="Nhập tên, có thể gõ không dấu" className="pl-11" />
        </div>
      </form>

      <section aria-labelledby="upcoming-title" className="overflow-hidden rounded-lg border border-border bg-card lg:col-start-1 lg:row-start-2">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-1">
            <h2 id="upcoming-title" className="font-heading text-2xl font-semibold">
              Giỗ trong 30 ngày tới
            </h2>
            <p className="text-sm text-muted-foreground">Hôm nay: {formatToday(gio!.today)}</p>
          </div>
          <Link href="/anniversaries" className="font-semibold text-primary underline underline-offset-4">
            Xem lịch giỗ
          </Link>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 py-6 text-muted-foreground">Không có ngày giỗ nào trong 30 ngày tới.</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((a) => (
              <AnniversaryRow key={a.id} a={a} />
            ))}
          </ul>
        )}
        {upcoming.length > shown.length && (
          <p className="border-t border-border px-5 py-3">
            <Link href="/anniversaries?range=30" className="font-semibold text-primary underline underline-offset-4">
              Xem thêm {upcoming.length - shown.length} ngày giỗ
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="shortcuts-title" className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
        <h2 id="shortcuts-title" className="font-heading text-2xl font-semibold">
          Lối tắt
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          <Shortcut href="/tree" icon={Network} title="Cây gia phả" desc="Xem toàn bộ dòng họ theo đời" />
          <Shortcut href="/members" icon={Users} title="Thành viên theo đời" desc="Danh sách, lọc theo đời, tìm kiếm" />
          <Shortcut href="/anniversaries" icon={CalendarDays} title="Lịch giỗ" desc="Tất cả ngày giỗ sắp tới" />
          {user.member && user.memberId !== null && (
            <Shortcut
              href={`/members/${user.memberId}`}
              icon={UserRound}
              title="Hồ sơ của tôi"
              desc={`${user.member.fullName}, Đời ${user.member.generation}`}
            />
          )}
        </ul>
      </section>
    </div>
  );
}
