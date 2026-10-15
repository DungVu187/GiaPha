import { User } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { AppNav } from "@/components/app-nav";
import { BrandSeal } from "@/components/brand-seal";
import { MobileMenu } from "@/components/mobile-menu";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { requireUser } from "@/lib/current-user";
import { LogoutButton } from "./logout-button";

// Chiều cao cố định qua biến CSS — trang cây (fixed) và dải lỗi đăng xuất bám theo:
// --header-h: 64px điện thoại, 72px từ 768px; --tabbar-h: 64px điện thoại (thanh tab đáy), 0 từ 768px.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-full flex-1 flex-col [--header-h:64px] [--tabbar-h:64px] md:[--header-h:72px] md:[--tabbar-h:0px]">
      <header className="flex h-(--header-h) shrink-0 items-center justify-between gap-4 border-b-2 border-accent bg-card px-4 md:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <BrandSeal />
          <span className="font-heading text-xl leading-7 font-bold text-primary md:sr-only lg:not-sr-only">GIA PHẢ HỌ VŨ</span>
        </div>
        <AppNav className="hidden self-stretch md:flex" />
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 font-medium lg:flex">
            <User aria-hidden="true" className="size-5 shrink-0" />
            <span className="max-w-[16ch] truncate">{user.username}</span>
          </span>
          <div className="hidden lg:block">
            <LogoutButton />
          </div>
          <div className="hidden md:block lg:hidden">
            <AccountMenu user={user} />
          </div>
          <MobileMenu user={user} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] px-5 pt-8 pb-[calc(var(--tabbar-h)+2rem)] sm:px-10 sm:pt-12 md:pb-12">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
