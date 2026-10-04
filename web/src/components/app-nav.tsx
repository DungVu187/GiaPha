"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Trang chủ", match: (p: string) => p === "/" },
  { href: "/members", label: "Thành viên", match: (p: string) => p.startsWith("/members") },
];

export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Điều hướng chính" className={cn("flex gap-6 overflow-x-auto", className)}>
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 py-1 font-bold whitespace-nowrap transition-colors",
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
