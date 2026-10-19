"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/lib/admin-users";
import { DIALOG_BACKDROP, DIALOG_POPUP, DIALOG_TITLE } from "./dialog-shell";

export function UnlinkDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function unlink() {
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/member`, { method: "DELETE" });
      if (res.status === 204) {
        onDone(`Đã gỡ liên kết tài khoản ${user.username}.`);
        router.refresh();
        return;
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      setError("Gỡ liên kết thất bại, vui lòng thử lại.");
    } catch {
      setError("Gỡ liên kết thất bại, vui lòng thử lại.");
    }
    setPending(false);
  }

  return (
    <AlertDialog.Root open onOpenChange={(o) => !o && !pending && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={DIALOG_BACKDROP} />
        <AlertDialog.Popup className={DIALOG_POPUP}>
          <AlertDialog.Title className={DIALOG_TITLE}>Gỡ liên kết tài khoản {user.username}?</AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground">
            Tài khoản {user.username} vẫn còn và vẫn đăng nhập được, nhưng không còn gắn với hồ sơ nào.
          </AlertDialog.Description>
          {user.member && (
            <div className="flex items-start gap-3 rounded-md border border-accent bg-primary-soft px-4 py-3 text-accent-text">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <p>
                Hồ sơ {user.member.fullName} (Đời {user.member.generation}) trở về trạng thái chưa có tài khoản — người đúng có thể nhận lại khi đăng ký (“Đây là tôi”).
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialog.Close render={<Button variant="outline" disabled={pending} />}>Hủy</AlertDialog.Close>
            <Button variant="danger" onClick={unlink} disabled={pending}>
              {pending ? "Đang gỡ…" : "Gỡ liên kết"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
