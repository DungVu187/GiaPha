export const SESSION_COOKIE = "giapha_session";

export type SessionUser = {
  id: number;
  username: string;
  role: "ADMIN" | "MEMBER";
  memberId: number | null;
};

export async function fetchCurrentUser(
  token: string | undefined,
  apiUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<SessionUser | null> {
  if (!token) return null;
  const res = await fetchFn(`${apiUrl}/api/auth/me`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`API /api/auth/me lỗi ${res.status}`);
  return (await res.json()) as SessionUser;
}
