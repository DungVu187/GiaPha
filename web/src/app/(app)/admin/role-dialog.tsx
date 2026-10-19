"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type AdminUser, isLastAdmin } from "@/lib/admin-users";
import { DIALOG_BACKDROP, DIALOG_POPUP, DIALOG_TITLE } from "./dialog-shell";

const LAST_ADMIN_MESSAGE = "Không thể hạ quyền Admin cuối cùng. Hãy cấp quyền Admin cho một tài khoản khác trước.";
export const ROLE_LABEL = { ADMIN: "Admin", MEMBER: "Thành viên" } as const;

export function RoleDialog({
  user,
  users,
  onClose,
  onDone,
}: {
  user: AdminUser;
  users: AdminUser[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState<AdminUser["role"]>(user.role);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const blocked = role === "MEMBER" && isLastAdmin(users, user.id);
  const message = blocked ? LAST_ADMIN_MESSAGE : error;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.status === 204) {
        onDone(`Đã đổi quyền ${user.username} thành ${ROLE_LABEL[role]}.`);
        router.refresh();
        return;
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
      setError(
        (res.status === 409 || res.status === 403) && typeof body?.message === "string"
          ? body.message
          : "Đổi quyền thất bại, vui lòng thử lại.",
      );
    } catch {
      setError("Đổi quyền thất bại, vui lòng thử lại.");
    }
    setPending(false);
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !pending && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className={DIALOG_BACKDROP} />
        <Dialog.Popup className={DIALOG_POPUP}>
          <Dialog.Title className={DIALOG_TITLE}>Đổi quyền tài khoản {user.username}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground">
            Admin quản lý mọi thành viên và tài khoản. Thành viên chỉ sửa được bản thân và bố, mẹ, vợ/chồng, con của mình.
          </Dialog.Description>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-role">Quyền mới</Label>
              <select
                id="admin-role"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminUser["role"])}
                className="h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
              </select>
            </div>
            {message && (
              <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <p>{message}</p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Dialog.Close render={<Button variant="outline" disabled={pending} />}>Hủy</Dialog.Close>
              <Button type="submit" disabled={pending || blocked || role === user.role}>
                {pending ? "Đang đổi…" : "Đổi quyền"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
