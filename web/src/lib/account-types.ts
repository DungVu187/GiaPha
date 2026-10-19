// Hợp đồng GET /api/account (api/src/account/account.ts).
export type AccountInfo = {
  username: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  member: { id: number; fullName: string; generation: number; avatarPath: string | null } | null;
};
