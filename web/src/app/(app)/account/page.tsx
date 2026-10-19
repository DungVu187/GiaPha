import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { AccountInfo } from "@/lib/account-types";
import { requireUser } from "@/lib/current-user";
import { EmailForm } from "./email-form";
import { PasswordForm } from "./password-form";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
      <dt className="w-48 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

export default async function AccountPage() {
  await requireUser();
  const a = (await apiGet<AccountInfo>("/api/account"))!;
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      <h1 className="font-heading text-3xl leading-10 font-semibold">Tài khoản của tôi</h1>
      <section aria-labelledby="info-title" className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 sm:p-8">
        <h2 id="info-title" className="font-heading text-2xl font-semibold">Thông tin tài khoản</h2>
        <dl className="flex flex-col gap-4">
          <Row label="Tên đăng nhập">
            <span className="font-medium">{a.username}</span>
            <span className="text-sm text-muted-foreground">(không đổi được)</span>
          </Row>
          <Row label="Hồ sơ trong gia phả">
            {a.member ? (
              <>
                <Link href={`/members/${a.member.id}`} className="font-semibold text-primary underline underline-offset-4">
                  {a.member.fullName}
                </Link>
                <span className="rounded-md bg-accent/20 px-2 py-0.5 text-sm font-semibold text-accent-text">Đời {a.member.generation}</span>
              </>
            ) : (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-sm">Chưa liên kết thành viên</span>
            )}
          </Row>
          <Row label="Vai trò">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-sm">{a.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</span>
          </Row>
        </dl>
      </section>
      <EmailForm initialEmail={a.email} />
      <PasswordForm />
    </div>
  );
}
