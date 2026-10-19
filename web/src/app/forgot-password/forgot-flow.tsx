"use client";

import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = { step: "form" } | { step: "sent"; identifier: string; maskedEmail: string } | { step: "no-email"; username: string };
type Reply = { status?: string; maskedEmail?: string; username?: string; message?: string; errors?: { identifier?: string } };

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive">
      <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

const LoginLink = ({ children }: { children: React.ReactNode }) => (
  <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
    {children}
  </Link>
);

export function ForgotFlow() {
  const [state, setState] = useState<Step>({ step: "form" });
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function request(identifier: string) {
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const body = (await res.json().catch(() => ({}))) as Reply;
      if (res.status === 200 && body.status === "sent" && body.maskedEmail) {
        setState({ step: "sent", identifier, maskedEmail: body.maskedEmail });
      } else if (res.status === 200 && body.status === "no-email" && body.username) {
        setState({ step: "no-email", username: body.username });
      } else {
        const msg = res.status === 400 ? body.errors?.identifier : body.message;
        setError(typeof msg === "string" ? msg : "Gửi link thất bại, vui lòng thử lại.");
      }
    } catch {
      setError("Không kết nối được máy chủ.");
    }
    setPending(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await request(String(new FormData(event.currentTarget).get("identifier") ?? ""));
  }

  if (state.step === "no-email") {
    return (
      <AuthCard title="Tài khoản chưa có email" description={`Tài khoản ${state.username} chưa lưu email nên không gửi được link đặt lại mật khẩu.`}>
        <div className="flex items-center gap-3 rounded-md border border-amber-600 bg-amber-50 px-4 py-3 font-medium text-amber-900">
          <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
          <p>Hãy nhờ quản trị viên dòng họ đặt lại mật khẩu cho bạn.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Quản trị viên đặt mật khẩu mới ở trang Quản trị và báo trực tiếp cho bạn. Đăng nhập xong, vào “Tài khoản của tôi” để đổi mật khẩu và thêm email.
        </p>
        <LoginLink>Về trang đăng nhập</LoginLink>
      </AuthCard>
    );
  }

  if (state.step === "sent") {
    const { identifier, maskedEmail } = state;
    return (
      <AuthCard
        title="Kiểm tra email của bạn"
        description="Mở thư “Đặt lại mật khẩu — Gia phả họ Vũ” và bấm link trong thư."
        footer={
          <p>
            Chưa nhận được thư?{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() => void request(identifier)}
              className="font-medium text-primary underline underline-offset-4 disabled:opacity-50"
            >
              Gửi lại
            </button>
          </p>
        }
      >
        {error && <ErrorBox>{error}</ErrorBox>}
        <div role="status" className="flex items-center gap-3 rounded-md border border-green-700 bg-green-50 px-4 py-3 font-medium text-green-900">
          <Check aria-hidden="true" className="size-5 shrink-0" />
          <p>Đã gửi link đặt lại mật khẩu tới {maskedEmail}.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Link chỉ dùng được một lần và hết hạn sau 30 phút. Không thấy thư? Xem thư mục Spam, hoặc gửi lại sau 1 phút.
        </p>
        <LoginLink>Về trang đăng nhập</LoginLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Quên mật khẩu"
      description="Nhập tên đăng nhập hoặc email đã lưu trong tài khoản. Chúng tôi sẽ gửi link đặt lại mật khẩu tới email đó."
      footer={
        <p>
          Nhớ ra mật khẩu?{" "}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Tên đăng nhập hoặc email</Label>
          <Input id="identifier" name="identifier" autoComplete="username" required />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang gửi…" : "Gửi link đặt lại"}
        </Button>
      </form>
    </AuthCard>
  );
}
