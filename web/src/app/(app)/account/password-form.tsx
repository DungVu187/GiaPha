"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuccessNotice } from "@/components/success-notice";
import { validateNewPassword } from "@/lib/account-form";

type Field = "currentPassword" | "newPassword" | "confirmPassword";
const ORDER: Field[] = ["currentPassword", "newPassword", "confirmPassword"];

export function PasswordForm() {
  const router = useRouter();
  const refs = {
    currentPassword: useRef<HTMLInputElement>(null),
    newPassword: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [success, setSuccess] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  function showErrors(next: Partial<Record<Field, string>>) {
    setErrors(next);
    const first = ORDER.find((f) => next[f]);
    if (first) refs[first].current?.focus();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrors({});
    setSuccess(undefined);
    setFailure(undefined);
    const currentPassword = refs.currentPassword.current?.value ?? "";
    const newPassword = refs.newPassword.current?.value ?? "";
    const confirmPassword = refs.confirmPassword.current?.value ?? "";
    const local: Partial<Record<Field, string>> = {
      ...(currentPassword ? {} : { currentPassword: "Vui lòng nhập mật khẩu hiện tại." }),
      ...validateNewPassword(newPassword, confirmPassword),
    };
    if (Object.keys(local).length > 0) {
      showErrors(local);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.ok) {
        form.reset();
        setSuccess("Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.");
      } else {
        const body = await res.json().catch(() => ({}));
        if (res.status === 400 && body.errors && (body.errors.currentPassword || body.errors.newPassword)) {
          showErrors({ currentPassword: body.errors.currentPassword, newPassword: body.errors.newPassword });
        } else {
          setFailure("Đổi mật khẩu thất bại, vui lòng thử lại.");
        }
      }
    } catch {
      setFailure("Đổi mật khẩu thất bại, vui lòng thử lại.");
    }
    setPending(false);
  }

  const field = (id: Field, label: string, autoComplete: string, hint?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={refs[id]}
        id={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint && !errors[id] && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      )}
      {errors[id] && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{errors[id]}</p>
      )}
    </div>
  );

  return (
    <section aria-labelledby="password-title" className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 sm:p-8">
      <h2 id="password-title" className="font-heading text-2xl font-semibold">Đổi mật khẩu</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {success && <SuccessNotice>{success}</SuccessNotice>}
        {failure && (
          <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive">
            <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
            <p>{failure}</p>
          </div>
        )}
        {field("currentPassword", "Mật khẩu hiện tại", "current-password")}
        {field("newPassword", "Mật khẩu mới", "new-password", "Ít nhất 8 ký tự.")}
        {field("confirmPassword", "Nhập lại mật khẩu mới", "new-password")}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Đang đổi…" : "Đổi mật khẩu"}
          </Button>
        </div>
      </form>
    </section>
  );
}
