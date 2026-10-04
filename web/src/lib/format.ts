import type { CalendarType, Gender, MemberDetail } from "./member-types";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatPartialDate(d: { year: number | null; month: number | null; day: number | null }): string {
  if (d.year === null) return "";
  if (d.month === null) return String(d.year);
  if (d.day === null) return `${pad2(d.month)}/${d.year}`;
  return `${pad2(d.day)}/${pad2(d.month)}/${d.year}`;
}

export const formatAnniversaryShort = (day: number, month: number, calendar: CalendarType) =>
  `${pad2(day)}/${pad2(month)}${calendar === "LUNAR" ? " ÂL" : ""}`;

export const formatAnniversaryLong = (day: number, month: number, calendar: CalendarType) =>
  `${pad2(day)}/${pad2(month)} ${calendar === "LUNAR" ? "Âm lịch" : "Dương lịch"}`;

export function formatDeathDate(
  m: Pick<MemberDetail, "deathYear" | "deathMonth" | "deathDay" | "deathCalendar" | "deathLunarLeap">,
): string {
  if (m.deathYear === null || m.deathCalendar === null) return "";
  const date = formatPartialDate({ year: m.deathYear, month: m.deathMonth, day: m.deathDay });
  const note =
    m.deathCalendar === "LUNAR" ? (m.deathLunarLeap ? "âm lịch, tháng nhuận" : "âm lịch") : "dương lịch";
  return `${date} (${note})`;
}

export const formatDaysLeft = (n: number) => (n === 0 ? "hôm nay" : `còn ${n} ngày`);
export const genderLabel = (g: Gender | null) => (g === "MALE" ? "Nam" : g === "FEMALE" ? "Nữ" : "Chưa rõ");
export const spouseLabel = (g: Gender | null) => (g === "MALE" ? "Vợ" : g === "FEMALE" ? "Chồng" : "Vợ/Chồng");

export function initialOf(fullName: string): string {
  const last = fullName.trim().split(/\s+/).pop() ?? "";
  return last ? last[0].toLocaleUpperCase("vi") : "?";
}
