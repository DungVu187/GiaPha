"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateNewPassword } from "@/lib/account-form";

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive">
      <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function InvalidLink() {
  return (
    <AuthCard title="Link không còn dùng được" description="Link đặt lại mật khẩu đã hết hạn, đã được dùng, hoặc không đúng.">
      <ErrorBox>Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.</ErrorBox>
      <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>
        Gửi link mới
      </Link>
      <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
        Về trang đăng nhập
      </Link>
    </AuthCard>
  );
}

type Errors = { newPassword?: string; confirmPassword?: string };

export function ResetForm({ token, username }: { token: string; username: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  if (invalid) return <InvalidLink />;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const found = validateNewPassword(newPassword, String(form.get("confirmPassword") ?? ""));
    setErrors(found);
    setFailure(undefined);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.status === 204) {
        router.replace("/login?reset=1");
        return;
      }
      if (res.status === 404) {
        setInvalid(true);
        return;
      }
      const body = res.status === 400 ? ((await res.json().catch(() => ({}))) as { errors?: { newPassword?: string } }) : {};
      if ("errors" in body && body.errors?.newPassword) setErrors({ newPassword: body.errors.newPassword });
      else setFailure("Đặt mật khẩu thất bại, vui lòng thử lại.");
    } catch {
      setFailure("Không kết nối được máy chủ.");
    }
    setPending(false);
  }

  return (
    <AuthCard
      title="Đặt mật khẩu mới"
      description={`Cho tài khoản ${username}. Sau khi lưu, các phiên đăng nhập cũ sẽ bị đăng xuất.`}
      footer={
        <p>
          Nhớ ra mật khẩu?{" "}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {failure && <ErrorBox>{failure}</ErrorBox>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword">Mật khẩu mới</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            aria-describedby={errors.newPassword ? "newPassword-error" : "newPassword-hint"}
          />
          {errors.newPassword ? (
            <p id="newPassword-error" role="alert" className="text-sm font-medium text-destructive">{errors.newPassword}</p>
          ) : (
            <p id="newPassword-hint" className="text-sm text-muted-foreground">Ít nhất 8 ký tự.</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Nhập lại mật khẩu mới</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          />
          {errors.confirmPassword && (
            <p id="confirmPassword-error" role="alert" className="text-sm font-medium text-destructive">{errors.confirmPassword}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu mật khẩu mới"}
        </Button>
      </form>
    </AuthCard>
  );
}
