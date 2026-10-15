import type { AnniversaryToday, SimpleDate, UpcomingAnniversary } from "./anniversary-types";
import { pad2 } from "./format";

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export const weekdayOf = (d: SimpleDate) => WEEKDAYS[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()];
export const formatSolarLong = (d: SimpleDate) => `${weekdayOf(d)}, ${pad2(d.day)}/${pad2(d.month)}/${d.year}`;

export function formatToday(t: AnniversaryToday): string {
  const solar = formatSolarLong(t.solar);
  if (!t.lunar) return solar;
  const { day, month, leap } = t.lunar;
  return `${solar} — ngày ${pad2(day)}/${pad2(month)}${leap ? " nhuận" : ""} năm ${t.lunarYearName} (âm lịch)`;
}

/** Nhóm theo tháng dương của ngày giỗ — đầu vào đã xếp theo ngày (API). */
export function groupByMonth(items: UpcomingAnniversary[]): { year: number; month: number; items: UpcomingAnniversary[] }[] {
  const groups: { year: number; month: number; items: UpcomingAnniversary[] }[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (last && last.year === it.date.year && last.month === it.date.month) last.items.push(it);
    else groups.push({ year: it.date.year, month: it.date.month, items: [it] });
  }
  return groups;
}

export const within = (items: UpcomingAnniversary[], days: number) => items.filter((i) => i.daysLeft <= days);

export type Urgency = "today" | "soon" | "later";
export const urgencyOf = (daysLeft: number): Urgency => (daysLeft === 0 ? "today" : daysLeft <= 7 ? "soon" : "later");
export const daysLeftLabel = (n: number) => (n === 0 ? "Hôm nay" : `Còn ${n} ngày`);
