"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MAX_AVATAR_BYTES } from "@/lib/relative-form";

const errorOf = async (res: Response, fallback: string) => {
  const data = (await res.json().catch(() => null)) as { message?: unknown; errors?: { file?: unknown } } | null;
  if (typeof data?.errors?.file === "string") return data.errors.file;
  return typeof data?.message === "string" ? data.message : fallback;
};

export function AvatarUpload({ memberId, hasAvatar }: { memberId: number; hasAvatar: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "removing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(init: RequestInit, ok: number, fallback: string) {
    try {
      const res = await fetch(`/api/members/${memberId}/avatar`, init);
      if (res.status === ok) router.refresh();
      else setError(await errorOf(res, fallback));
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setStatus("idle");
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Ảnh tối đa 5 MB.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setStatus("uploading");
    await send({ method: "POST", body: form }, 200, "Tải ảnh thất bại, vui lòng thử lại.");
  }

  async function remove() {
    setError(null);
    setStatus("removing");
    await send({ method: "DELETE" }, 204, "Xóa ảnh thất bại, vui lòng thử lại.");
  }

  const busy = status !== "idle";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        <label className={buttonVariants({ variant: "outline", size: "sm", className: "cursor-pointer has-focus-visible:ring-3 has-focus-visible:ring-ring has-disabled:pointer-events-none has-disabled:opacity-50" })}>
          <span>Đổi ảnh</span>
          <span className="sr-only">Chọn ảnh đại diện</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={upload}
          />
        </label>
        {hasAvatar && (
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
            Xóa ảnh
          </Button>
        )}
      </div>
      {status === "uploading" && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải ảnh...
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
