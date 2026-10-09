import { formatPartialDate } from "./format";

export type RegisterValues = { username: string; password: string; fullName: string; generation: string; email: string };
export type RegisterClaim = number | "NEW" | null;
export type RegisterMatch = {
  id: number;
  fullName: string;
  generation: number;
  fatherName: string | null;
  motherName: string | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
};

// ponytail: chọn Đời 1–30 theo Figma 02; API nhận tới 200 — nới danh sách khi có người đời > 30.
export const GENERATION_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);
export const REGISTER_FIELDS = ["username", "password", "fullName", "generation", "email"] as const;
export type RegisterField = (typeof REGISTER_FIELDS)[number];
export type RegisterErrors = Partial<Record<RegisterField, string>>;
export const NO_INFO = "Chưa có thông tin";
const FALLBACK_ERROR = "Đăng ký thất bại, vui lòng thử lại.";

export function toRegisterBody(v: RegisterValues, claim: RegisterClaim): Record<string, unknown> {
  return {
    username: v.username,
    password: v.password,
    fullName: v.fullName,
    generation: v.generation === "" ? null : Number(v.generation),
    email: v.email.trim() === "" ? null : v.email,
    ...(claim === null ? {} : { claim }),
  };
}

export type RegisterOutcome =
  | { kind: "created" }
  | { kind: "matches"; matches: RegisterMatch[] }
  | { kind: "taken"; message: string; matches: RegisterMatch[] }
  | { kind: "field-errors"; errors: RegisterErrors }
  | { kind: "error"; message: string };

/** Đọc kết quả POST /api/auth/register thành việc giao diện cần làm. */
export function interpretRegisterResponse(status: number, body: unknown): RegisterOutcome {
  if (status === 201) return { kind: "created" };
  const b = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const message = typeof b.message === "string" ? b.message : FALLBACK_ERROR;
  const matches = Array.isArray(b.matches) ? (b.matches as RegisterMatch[]) : null;
  if (status === 200 && matches) return { kind: "matches", matches };
  if (status === 409 && matches) return { kind: "taken", message, matches };
  if (status === 400 && b.errors !== null && typeof b.errors === "object") {
    const raw = b.errors as Record<string, unknown>;
    const errors: RegisterErrors = {};
    for (const f of REGISTER_FIELDS) if (typeof raw[f] === "string") errors[f] = raw[f];
    if (Object.keys(errors).length > 0) return { kind: "field-errors", errors };
  }
  return { kind: "error", message };
}

export const matchesIntro = (count: number, fullName: string, generation: number) =>
  `Gia phả đã có ${count} người tên ${fullName}, Đời ${generation} chưa có tài khoản. ` +
  (count === 1 ? "Nếu đó là bạn" : "Nếu một trong số này là bạn") +
  ", chọn “Đây là tôi” để nhận hồ sơ đó.";

export const createNewHint = (fullName: string, generation: number) =>
  `Tạo hồ sơ mới mang tên ${fullName}, Đời ${generation}. Tên trùng với người khác là bình thường.`;

export const matchBirth = (m: RegisterMatch) =>
  m.birthYear === null ? NO_INFO : formatPartialDate({ year: m.birthYear, month: m.birthMonth, day: m.birthDay });
