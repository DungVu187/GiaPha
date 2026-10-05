"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RemoveSpouseButton({
  memberId,
  fullName,
  spouseId,
  spouseName,
}: {
  memberId: number;
  fullName: string;
  spouseId: number;
  spouseName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}/spouses/${spouseId}`, { method: "DELETE" });
      if (res.status === 204) {
        setOpen(false);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
      setError(
        [403, 404, 409].includes(res.status) && typeof body?.message === "string"
          ? body.message
          : "Gỡ thất bại, vui lòng thử lại.",
      );
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <AlertDialog.Trigger
        render={<Button variant="ghost" size="sm" aria-label={`Gỡ quan hệ vợ chồng với ${spouseName}`} />}
      >
        Gỡ
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-foreground/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-card p-6 shadow-(--shadow-card)">
          <AlertDialog.Title className="font-heading text-xl font-semibold">
            Gỡ quan hệ vợ chồng giữa {fullName} và {spouseName}?
          </AlertDialog.Title>
          <AlertDialog.Description>Hai người vẫn còn trong gia phả.</AlertDialog.Description>
          {error && (
            <p role="alert" className="font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialog.Close render={<Button variant="outline" />}>Hủy</AlertDialog.Close>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              Gỡ quan hệ
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
