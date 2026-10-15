// Hợp đồng GET /api/anniversaries (api/src/members/anniversaries.controller.ts).
export type SimpleDate = { year: number; month: number; day: number };
export type UpcomingAnniversary = {
  id: number;
  fullName: string;
  generation: number;
  avatarPath: string | null;
  day: number;
  month: number;
  calendar: "SOLAR" | "LUNAR";
  date: SimpleDate;
  daysLeft: number;
};
export type AnniversaryToday = {
  solar: SimpleDate;
  lunar: { year: number; month: number; day: number; leap: boolean } | null;
  lunarYearName: string | null;
};
export type AnniversaryList = { today: AnniversaryToday; items: UpcomingAnniversary[] };
