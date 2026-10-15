import { CalendarDays, ChevronDown } from "lucide-react";
import Link from "next/link";
import { AnniversaryLegend, AnniversaryRow } from "@/components/anniversary-row";
import { apiGet } from "@/lib/api";
import type { AnniversaryList } from "@/lib/anniversary-types";
import { formatToday, groupByMonth, within } from "@/lib/anniversary-view";
import { requireUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";

function HowItWorks() {
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-6">
      <p>Giỗ âm lịch: đổi ngày/tháng âm của năm nay sang dương lịch. Đã qua thì lấy năm sau.</p>
      <p>Tháng âm năm đó không có ngày 30 → làm giỗ ngày 29.</p>
      <p>Người mất vào tháng nhuận → giỗ theo tháng thường cùng số.</p>
      <p>Giỗ dương lịch: ngày/tháng dương năm nay. 29/02 năm không nhuận → 28/02.</p>
      <hr className="border-border" />
      <AnniversaryLegend />
    </div>
  );
}

function RangeLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center rounded-md px-4 font-medium",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default async function AnniversariesPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  await requireUser();
  const days30 = (await searchParams).range === "30";
  const data = (await apiGet<AnniversaryList>("/api/anniversaries"))!;
  const groups = groupByMonth(days30 ? within(data.items, 30) : data.items);
  const rangeLabel = days30 ? "30 ngày tới" : "12 tháng tới";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl leading-10 font-semibold">Lịch giỗ</h1>
          <p className="text-muted-foreground">Hôm nay: {formatToday(data.today)}</p>
        </div>
        <nav aria-label="Khoảng thời gian" className="flex gap-1 rounded-lg bg-secondary p-1">
          <RangeLink href="/anniversaries?range=30" active={days30}>
            30 ngày tới
          </RangeLink>
          <RangeLink href="/anniversaries" active={!days30}>
            12 tháng tới
          </RangeLink>
        </nav>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-8 text-center">
              <CalendarDays aria-hidden="true" className="size-7 text-muted-foreground" />
              <p className="font-heading text-lg font-semibold">Chưa có ngày giỗ nào trong {rangeLabel}.</p>
              <p className="text-sm text-muted-foreground">
                Ngày giỗ hiện ở đây khi hồ sơ người đã khuất có ngày giỗ (âm lịch hoặc dương lịch).
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section
                key={`${g.year}-${g.month}`}
                aria-labelledby={`m-${g.year}-${g.month}`}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <h2 id={`m-${g.year}-${g.month}`} className="flex flex-wrap items-baseline gap-x-3 bg-secondary px-5 py-3 font-heading text-xl font-semibold">
                  Tháng {g.month}/{g.year}
                  <span className="font-sans text-sm font-normal text-muted-foreground">{g.items.length} ngày giỗ</span>
                </h2>
                <ul className="divide-y divide-border">
                  {g.items.map((a) => (
                    <AnniversaryRow key={a.id} a={a} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <aside aria-labelledby="how-title" className="hidden rounded-lg border border-border bg-card p-6 lg:block">
          <h2 id="how-title" className="mb-4 font-heading text-xl font-semibold">
            Cách tính ngày giỗ
          </h2>
          <HowItWorks />
        </aside>
        <details className="group rounded-lg border border-border bg-card lg:hidden">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold">
            Cách tính ngày giỗ
            <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">
            <HowItWorks />
          </div>
        </details>
      </div>
    </div>
  );
}
