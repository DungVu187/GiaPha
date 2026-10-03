import { redirect } from "next/navigation";
import { BrandSeal } from "@/components/brand-seal";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { LoginForm } from "./login-form";

// "Quên mật khẩu?" (GĐ6, chỉ khi có SMTP) và link "Đăng ký" (GĐ3) chưa hiện ở GĐ1.
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-20">
      <Card className="w-full max-w-[480px] gap-5 rounded-lg px-6 py-8 text-base ring-0 border border-border shadow-[0_8px_24px_0_rgb(36_28_23/0.08)] sm:gap-6 sm:p-10">
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
        <LoginForm />
      </Card>
    </main>
  );
}
