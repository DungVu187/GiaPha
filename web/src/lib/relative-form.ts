import { type PickedMember, parseNumberField } from "./member-form";
import type { Gender } from "./member-types";

export type RelationKind = "FATHER" | "MOTHER" | "SPOUSE" | "CHILD";

// otherParentId: chỉ dùng khi thêm con — vợ/chồng của người đang xem làm bố/mẹ còn lại.
export type NewRelativeState = {
  fullName: string;
  gender: Gender | null;
  birthYear: string;
  isDeceased: boolean;
  otherParentId?: number | null;
};

export type RelativeChoice = { existing: PickedMember } | { created: NewRelativeState };

// Bản web để báo sớm trước khi gửi; API vẫn kiểm (413).
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const opposite = (g: Gender | null): Gender | null => (g === "MALE" ? "FEMALE" : g === "FEMALE" ? "MALE" : null);

export function relativeGender(relation: RelationKind, personGender: Gender | null): Gender | null {
  if (relation === "FATHER") return "MALE";
  if (relation === "MOTHER") return "FEMALE";
  if (relation === "SPOUSE") return opposite(personGender);
  return null;
}

export function relationTitle(relation: RelationKind, personGender: Gender | null): string {
  if (relation === "FATHER") return "Thêm bố";
  if (relation === "MOTHER") return "Thêm mẹ";
  if (relation === "CHILD") return "Thêm con";
  return personGender === "MALE" ? "Thêm vợ" : personGender === "FEMALE" ? "Thêm chồng" : "Thêm vợ/chồng";
}

export function relativeBody(
  relation: RelationKind,
  choice: RelativeChoice,
  personGender: Gender | null = null,
): Record<string, unknown> {
  if ("existing" in choice) return { relation, existingId: choice.existing.id };
  const { fullName, gender, birthYear, isDeceased, otherParentId } = choice.created;
  const member: Record<string, unknown> = { fullName, gender, birthYear: parseNumberField(birthYear), isDeceased };
  if (relation === "CHILD" && otherParentId != null && personGender !== null) {
    member[personGender === "MALE" ? "motherId" : "fatherId"] = otherParentId;
  }
  return { relation, member };
}
