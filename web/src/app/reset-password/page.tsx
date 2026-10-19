import { apiPostPublic } from "@/lib/api";
import { InvalidLink, ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const check = token ? await apiPostPublic<{ username: string }>("/api/auth/password-reset/check", { token }) : null;
  if (!check || check.status !== 200 || !check.body) return <InvalidLink />;
  return <ResetForm token={token} username={check.body.username} />;
}
