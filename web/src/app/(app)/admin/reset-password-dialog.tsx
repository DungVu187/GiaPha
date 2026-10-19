"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateNewPassword } from "@/lib/account-form";
import type { AdminUser } from "@/lib/admin-users";
import { DIALOG_BACKDROP, DIALOG_POPUP, DIALOG_TITLE } from "./dialog-shell";

export function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputRef.current?.value ?? "";
    const local = validateNewPassword(value, value).newPassword;
    if (local) {
      setError(local);
      inputRef.current?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: value }),
      });
      if (res.status === 204) {
        onDone(`Đã đặt lại mật khẩu cho ${user.username}. Hãy báo mật khẩu mới trực tiếp cho người dùng.`);
        router.refresh();
        return;
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: unknown; errors?: { newPassword?: unknown } } | null;
      const msg = typeof body?.errors?.newPassword === "string" ? body.errors.newPassword : body?.message;
      setError(res.status === 400 && typeof msg === "string" ? msg : "Đặt lại thất bại, vui lòng thử lại.");
    } catch {
      setError("Đặt lại thất bại, vui lòng thử lại.");
    }
    setPending(false);
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !pending && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className={DIALOG_BACKDROP} />
        <Dialog.Popup className={DIALOG_POPUP}>
          <Dialog.Title className={DIALOG_TITLE}>Đặt lại mật khẩu cho {user.username}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground">
            {user.member && `Tài khoản của ${user.member.fullName} (Đời ${user.member.generation}). `}
            Sau khi đặt lại, hãy báo mật khẩu mới trực tiếp cho người dùng.
          </Dialog.Description>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-new-password">Mật khẩu mới</Label>
              <Input
                ref={inputRef}
                id="admin-new-password"
                type="text"
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "admin-new-password-error" : "admin-new-password-hint"}
              />
              {error ? (
                <p id="admin-new-password-error" role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : (
                <p id="admin-new-password-hint" className="text-sm text-muted-foreground">
                  Ít nhất 8 ký tự. Phiên đăng nhập cũ của tài khoản này sẽ bị đăng xuất.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Dialog.Close render={<Button variant="outline" disabled={pending} />}>Hủy</Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
