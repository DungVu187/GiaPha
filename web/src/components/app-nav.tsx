"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEM, NAV_ITEMS } from "./nav-items";

export function AppNav({ className, isAdmin }: { className?: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
  return (
    <nav aria-label="Điều hướng chính" className={cn("gap-5 lg:gap-6", className)}>
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center border-b-2 pt-0.5 font-bold whitespace-nowrap transition-colors",
              active ? "border-primary text-primary" : "border-transparent hover:text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
