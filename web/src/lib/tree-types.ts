// Hợp đồng GET /api/tree (api/src/lib/tree.ts).
export type Calendar = "SOLAR" | "LUNAR";
export type TreeCard = {
  id: number;
  fullName: string;
  searchName: string;
  generation: number;
  gender: "MALE" | "FEMALE" | null;
  isDeceased: boolean;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  deathCalendar: Calendar | null;
  anniversaryDay: number | null;
  anniversaryMonth: number | null;
  anniversaryCalendar: Calendar | null;
  burialPlace: string | null;
  avatarPath: string | null;
  fatherName: string | null;
};
export type TreeFamily = { id: number; generation: number; person: TreeCard; spouses: TreeCard[]; childIds: number[] };
export type TreeData = { families: TreeFamily[]; roots: number[] };
