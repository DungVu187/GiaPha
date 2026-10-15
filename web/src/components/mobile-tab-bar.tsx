"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Thanh điều hướng dưới"
      className="fixed inset-x-0 bottom-0 z-30 grid h-(--tabbar-h) grid-cols-4 border-t border-border bg-card md:hidden"
    >
      {NAV_ITEMS.map(({ href, short, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-[13px] font-medium",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-6" />
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
