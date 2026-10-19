"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuccessNotice } from "@/components/success-notice";

export function EmailForm({ initialEmail }: { initialEmail: string | null }) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ email?: string; currentPassword?: string }>({});
  const [success, setSuccess] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setSuccess(undefined);
    setFailure(undefined);
    setPending(true);
    try {
      const res = await fetch("/api/account/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRef.current?.value ?? "", currentPassword: passwordRef.current?.value ?? "" }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const saved = typeof body.email === "string" ? body.email : "";
        if (emailRef.current) emailRef.current.value = saved;
        if (passwordRef.current) passwordRef.current.value = "";
        setSuccess(saved ? "Đã lưu email." : "Đã xóa email.");
      } else if (res.status === 400 && body.errors && (body.errors.email || body.errors.currentPassword)) {
        setErrors({ email: body.errors.email, currentPassword: body.errors.currentPassword });
        (body.errors.email ? emailRef : passwordRef).current?.focus();
      } else {
        setFailure("Lưu email thất bại, vui lòng thử lại.");
      }
    } catch {
      setFailure("Lưu email thất bại, vui lòng thử lại.");
    }
    setPending(false);
  }

  return (
    <section aria-labelledby="email-title" className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="email-title" className="font-heading text-2xl font-semibold">Email</h2>
        <p className="text-muted-foreground">
          Dùng để lấy lại mật khẩu khi quên. Không bắt buộc — nếu không có email, nhờ quản trị viên đặt lại mật khẩu.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {success && <SuccessNotice>{success}</SuccessNotice>}
        {failure && (
          <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive">
            <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
            <p>{failure}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            autoComplete="email"
            defaultValue={initialEmail ?? ""}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-sm font-medium text-destructive">{errors.email}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="emailCurrentPassword">Mật khẩu hiện tại</Label>
          <Input
            ref={passwordRef}
            id="emailCurrentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.currentPassword ? true : undefined}
            aria-describedby={errors.currentPassword ? "emailCurrentPassword-error" : "emailCurrentPassword-hint"}
          />
          <p id="emailCurrentPassword-hint" className="text-sm text-muted-foreground">Nhập mật khẩu để xác nhận đổi email.</p>
          {errors.currentPassword && (
            <p id="emailCurrentPassword-error" role="alert" className="text-sm font-medium text-destructive">{errors.currentPassword}</p>
          )}
        </div>
        <div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu email"}
          </Button>
        </div>
      </form>
    </section>
  );
}
