import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./fetch-current-user";
import { fetchPasswordResetEnabled } from "./password-reset-enabled";

const API_URL = () => process.env.API_URL ?? "http://localhost:4000";

export async function apiGet<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${API_URL()}${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`API ${path} lỗi ${res.status}`);
  return (await res.json()) as T;
}

/** POST tới API từ server component, không kèm cookie (route công khai). */
export async function apiPostPublic<T>(path: string, body: unknown): Promise<{ status: number; body: T | null }> {
  const res = await fetch(`${API_URL()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T | null };
}

/** Quên mật khẩu đã bật chưa; API lỗi / không gọi được → false (không làm sập trang đăng nhập). */
export function passwordResetEnabled(): Promise<boolean> {
  return fetchPasswordResetEnabled(API_URL());
}
