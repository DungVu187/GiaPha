import type { CalendarType, Gender, MemberDetail } from "./member-types";

export type PickedMember = { id: number; fullName: string; generation: number };

// Mọi ô nhập là chuỗi để giữ nguyên chữ người dùng gõ; server mới là nơi kiểm tra.
export type MemberFormState = {
  fullName: string;
  gender: Gender | null;
  generation: string;
  birthOrder: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  isDeceased: boolean;
  deathDay: string;
  deathMonth: string;
  deathYear: string;
  deathCalendar: CalendarType;
  deathLunarLeap: boolean;
  anniversaryDay: string;
  anniversaryMonth: string;
  anniversaryCalendar: CalendarType;
  burialPlace: string;
  note: string;
  father: PickedMember | null;
  mother: PickedMember | null;
};

// Rỗng → null; toàn chữ số → number; còn lại gửi nguyên chuỗi để server báo lỗi tiếng Việt.
export function parseNumberField(v: string): number | string | null {
  const t = v.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : v;
}

export const emptyMemberForm = (): MemberFormState => ({
  fullName: "",
  gender: null,
  generation: "",
  birthOrder: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  isDeceased: false,
  deathDay: "",
  deathMonth: "",
  deathYear: "",
  deathCalendar: "SOLAR",
  deathLunarLeap: false,
  anniversaryDay: "",
  anniversaryMonth: "",
  anniversaryCalendar: "LUNAR",
  burialPlace: "",
  note: "",
  father: null,
  mother: null,
});

const str = (n: number | null) => (n === null ? "" : String(n));
const picked = (m: PickedMember | null): PickedMember | null =>
  m && { id: m.id, fullName: m.fullName, generation: m.generation };

export const memberFormFromDetail = (d: MemberDetail): MemberFormState => ({
  fullName: d.fullName,
  gender: d.gender,
  generation: str(d.generation),
  birthOrder: str(d.birthOrder),
  birthDay: str(d.birthDay),
  birthMonth: str(d.birthMonth),
  birthYear: str(d.birthYear),
  isDeceased: d.isDeceased,
  deathDay: str(d.deathDay),
  deathMonth: str(d.deathMonth),
  deathYear: str(d.deathYear),
  deathCalendar: d.deathCalendar ?? "SOLAR",
  deathLunarLeap: d.deathLunarLeap,
  anniversaryDay: str(d.anniversaryDay),
  anniversaryMonth: str(d.anniversaryMonth),
  anniversaryCalendar: d.anniversaryCalendar ?? "LUNAR",
  burialPlace: d.burialPlace ?? "",
  note: d.note ?? "",
  father: picked(d.father),
  mother: picked(d.mother),
});

const filled = (...vs: string[]) => vs.some((v) => v.trim() !== "");

export function toMemberBody(s: MemberFormState): Record<string, unknown> {
  const body: Record<string, unknown> = {
    fullName: s.fullName,
    gender: s.gender,
    generation: parseNumberField(s.generation),
    birthOrder: parseNumberField(s.birthOrder),
    birthYear: parseNumberField(s.birthYear),
    birthMonth: parseNumberField(s.birthMonth),
    birthDay: parseNumberField(s.birthDay),
    isDeceased: s.isDeceased,
    note: s.note,
    fatherId: s.father?.id ?? null,
    motherId: s.mother?.id ?? null,
  };
  if (!s.isDeceased) return body;
  const hasDeath = filled(s.deathDay, s.deathMonth, s.deathYear);
  return {
    ...body,
    deathYear: parseNumberField(s.deathYear),
    deathMonth: parseNumberField(s.deathMonth),
    deathDay: parseNumberField(s.deathDay),
    deathCalendar: hasDeath ? s.deathCalendar : null,
    deathLunarLeap: hasDeath && s.deathCalendar === "LUNAR" && s.deathLunarLeap,
    anniversaryDay: parseNumberField(s.anniversaryDay),
    anniversaryMonth: parseNumberField(s.anniversaryMonth),
    anniversaryCalendar: filled(s.anniversaryDay, s.anniversaryMonth) ? s.anniversaryCalendar : null,
    burialPlace: s.burialPlace,
  };
}

export function parentGenerationPreview(s: MemberFormState): number | null {
  if (s.father) return s.father.generation + 1;
  if (s.mother) return s.mother.generation + 1;
  return null;
}
