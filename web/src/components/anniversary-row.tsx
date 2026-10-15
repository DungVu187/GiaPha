import Link from "next/link";
import type { UpcomingAnniversary } from "@/lib/anniversary-types";
import { daysLeftLabel, formatSolarLong, urgencyOf } from "@/lib/anniversary-view";
import { pad2 } from "@/lib/format";
import { cn } from "@/lib/utils";

const PILL = {
  today: "bg-primary text-primary-foreground",
  // Review Figma #5: "còn ≤ 7 ngày" phải khác hẳn màu ô âm/dương lịch → viền đỏ + chữ đỏ đậm.
  soon: "border border-primary bg-primary-soft text-primary",
  later: "bg-secondary text-foreground",
} as const;

export function DaysLeftPill({ daysLeft }: { daysLeft: number }) {
  return (
    <span className={cn("inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap", PILL[urgencyOf(daysLeft)])}>
      {daysLeftLabel(daysLeft)}
    </span>
  );
}

export function DateBox({ day, month, calendar }: { day: number; month: number; calendar: "SOLAR" | "LUNAR" }) {
  const lunar = calendar === "LUNAR";
  return (
    <span
      className={cn(
        "flex w-[72px] shrink-0 flex-col items-center rounded-md border py-2",
        lunar ? "border-accent bg-accent/15 text-primary" : "border-border bg-secondary text-foreground",
      )}
    >
      <span className="font-heading text-2xl leading-none">
        {pad2(day)}/{pad2(month)}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{lunar ? "Âm lịch" : "Dương lịch"}</span>
    </span>
  );
}

export function AnniversaryRow({ a }: { a: UpcomingAnniversary }) {
  return (
    <li>
      <Link
        href={`/members/${a.id}`}
        className={cn(
          "grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-4 py-4 hover:bg-primary-soft/60 focus-visible:bg-primary-soft/60 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:px-5",
          a.daysLeft === 0 && "bg-primary-soft",
        )}
      >
        <span className="row-span-2 sm:row-span-1">
          <DateBox day={a.day} month={a.month} calendar={a.calendar} />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-heading text-lg font-semibold">{a.fullName}</span>
            <span className="text-sm font-semibold text-accent-text">Đời {a.generation}</span>
          </span>
          <span className="text-muted-foreground">
            {formatSolarLong(a.date)}
            {a.calendar === "LUNAR" ? " (dương lịch)" : " — giỗ theo dương lịch"}
          </span>
        </span>
        <span className="col-start-2 sm:col-start-auto">
          <DaysLeftPill daysLeft={a.daysLeft} />
        </span>
      </Link>
    </li>
  );
}

/** Chú giải màu — dùng đúng kiểu của ô ngày và nhãn còn ngày. */
export function AnniversaryLegend() {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-6 rounded-sm border border-accent bg-accent/15" /> Giỗ theo âm lịch
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-6 rounded-sm border border-border bg-secondary" /> Giỗ theo dương lịch
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-6 rounded-full border border-primary bg-primary-soft" /> Hôm nay / còn ≤ 7 ngày
      </li>
    </ul>
  );
}
