import { User } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { BrandSeal } from "@/components/brand-seal";
import { requireUser } from "@/lib/current-user";
import { LogoutButton } from "./logout-button";

// Header: thương hiệu, điều hướng (mobile: xuống dòng thứ hai, cao 40px), tài khoản.
// Tổng cao: mobile 104px, desktop 72px — dải lỗi đăng xuất (logout-button.tsx) bám theo các số này.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 border-b-2 border-accent bg-card px-4 sm:flex-nowrap sm:px-10">
        <div className="flex h-[62px] items-center gap-3 sm:h-[70px]">
          <BrandSeal />
          <span className="sr-only font-heading text-xl leading-7 font-bold text-primary sm:not-sr-only">GIA PHẢ HỌ VŨ</span>
        </div>
        <AppNav className="order-last h-10 w-full items-center sm:order-none sm:h-auto sm:w-auto" />
        <div className="flex h-[62px] items-center gap-4 sm:h-[70px]">
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
