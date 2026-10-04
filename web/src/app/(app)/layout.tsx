import { User } from "lucide-react";
import { BrandSeal } from "@/components/brand-seal";
import { requireUser } from "@/lib/current-user";
import { LogoutButton } from "./logout-button";

// GĐ1: header chỉ có thương hiệu + tài khoản; thanh điều hướng thêm khi có các trang (GĐ2+).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b-2 border-accent bg-card px-4 sm:h-[72px] sm:px-10">
        <div className="flex items-center gap-3">
          <BrandSeal />
          <span className="sr-only font-heading text-xl leading-7 font-bold text-primary sm:not-sr-only">GIA PHẢ HỌ VŨ</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 font-medium">
            <User aria-hidden="true" className="size-5 shrink-0" />
            <span className="max-w-[40vw] truncate">{user.username}</span>
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-10 sm:py-12">{children}</main>
    </div>
  );
}
