"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Điều hướng chính" className={cn("gap-5 lg:gap-6", className)}>
      {NAV_ITEMS.map((item) => {
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
