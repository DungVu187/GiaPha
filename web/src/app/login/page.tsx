import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandSeal } from "@/components/brand-seal";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  const enabled = (await apiGet<{ enabled: boolean }>("/api/auth/password-reset/enabled"))?.enabled ?? false;
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-20">
      <Card className="w-full max-w-[480px] gap-5 rounded-lg px-6 py-8 text-base ring-0 border border-border shadow-[var(--shadow-card)] sm:gap-6 sm:p-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandSeal className="size-14 sm:size-16" />
          <h1 className="font-heading text-2xl leading-8 font-bold text-primary sm:text-[32px] sm:leading-10">
            GIA PHẢ HỌ VŨ
          </h1>
          <p className="text-muted-foreground">
            Đăng nhập để xem cây gia phả, thành viên và lịch giỗ của dòng họ.
          </p>
          <div aria-hidden="true" className="hidden h-0.5 w-16 bg-accent sm:block" />
        </div>
        <LoginForm canReset={enabled} justReset={sp.reset === "1"} />
        <div className="flex flex-col items-center gap-4 border-t border-border pt-5 text-muted-foreground">
          <p>
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-medium text-primary underline underline-offset-4">
              Đăng ký
            </Link>
          </p>
        </div>
      </Card>
    </main>
  );
}
