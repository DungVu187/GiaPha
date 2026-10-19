import { pad2 } from "./format";
import { toSearchName } from "./name";

// Hợp đồng GET /api/admin/users (api/src/admin/admin.ts).
export type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  createdAt: string;
  claimedAt: string | null;
  member: { id: number; fullName: string; generation: number; avatarPath: string | null } | null;
};

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export const isRecentClaim = (claimedAt: string | null, now: Date) =>
  claimedAt !== null && now.getTime() - new Date(claimedAt).getTime() <= RECENT_MS;

export function filterUsers(users: AdminUser[], query: string, onlyRecentClaims: boolean, now: Date): AdminUser[] {
  const q = toSearchName(query);
  return users.filter(
    (u) =>
      (!onlyRecentClaims || isRecentClaim(u.claimedAt, now)) &&
      (!q || toSearchName(u.username).includes(q) || (u.member !== null && toSearchName(u.member.fullName).includes(q))),
  );
}

export const isLastAdmin = (users: AdminUser[], userId: number) =>
  users.find((u) => u.id === userId)?.role === "ADMIN" && users.filter((u) => u.role === "ADMIN").length === 1;

export function formatDateVN(iso: string): string {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
