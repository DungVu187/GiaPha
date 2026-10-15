"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/app/(app)/logout-button";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/fetch-current-user";
import { initialOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/** Ngăn kéo phải trên điện thoại (Figma M13). */
export function MobileMenu({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const name = user.member?.fullName ?? user.username;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="outline" aria-label="Mở menu" className="size-11 p-0 md:hidden" />}>
        <Menu aria-hidden="true" className="size-6" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[310px] max-w-[85vw] flex-col bg-card shadow-(--shadow-card)">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent bg-secondary font-heading text-lg font-semibold text-accent-text"
            >
              {initialOf(name)}
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-heading text-lg font-semibold">{name}</Dialog.Title>
              <p className="truncate text-sm text-muted-foreground">
                {user.username}
                {user.member ? ` · Đời ${user.member.generation}` : ""}
              </p>
            </div>
            <Dialog.Close render={<Button variant="ghost" aria-label="Đóng menu" className="size-11 p-0" />}>
              <X aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>
          <nav aria-label="Menu" className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md px-3 font-medium",
                    active ? "bg-primary-soft text-primary" : "hover:bg-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <LogoutButton variant="menu" />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
