"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function logout() {
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.replace("/login");
        router.refresh();
        return;
      }
    } catch {
      // Lỗi mạng: báo chung như lỗi máy chủ ở dưới.
    }
    setError("Đăng xuất thất bại, vui lòng thử lại.");
    setPending(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={logout} disabled={pending}>
        <LogOut aria-hidden="true" />
        Đăng xuất
      </Button>
      {error && (
        <p
          role="alert"
          className="fixed inset-x-0 top-16 z-10 border-b border-destructive bg-primary-soft px-4 py-2 text-sm font-medium text-destructive sm:top-[72px] sm:px-10"
        >
          {error}
        </p>
      )}
    </>
  );
}
