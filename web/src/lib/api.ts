import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./fetch-current-user";

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
