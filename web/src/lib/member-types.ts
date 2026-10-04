// Khớp kiểu trả về của api/src/members/member-service.ts.
export type Gender = "MALE" | "FEMALE";
export type CalendarType = "SOLAR" | "LUNAR";

export type MemberSummary = {
  id: number;
  fullName: string;
  generation: number;
  gender: Gender | null;
  isDeceased: boolean;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  deathCalendar: CalendarType | null;
  avatarPath: string | null;
};

export type SpouseSummary = MemberSummary & {
  marriageId: number;
  order: number | null;
  note: string | null;
};

export type SearchResult = MemberSummary & {
  fatherName: string | null;
  motherName: string | null;
};

export type MemberDetail = MemberSummary & {
  birthOrder: number | null;
  deathLunarLeap: boolean;
  anniversaryDay: number | null;
  anniversaryMonth: number | null;
  anniversaryCalendar: CalendarType | null;
  burialPlace: string | null;
  note: string | null;
  fatherId: number | null;
  motherId: number | null;
  father: MemberSummary | null;
  mother: MemberSummary | null;
  spouses: SpouseSummary[];
  children: MemberSummary[];
  generationLocked: boolean;
  nextAnniversary: { date: { day: number; month: number; year: number }; daysLeft: number } | null;
  permissions: { canEdit: boolean; canDelete: boolean };
};
