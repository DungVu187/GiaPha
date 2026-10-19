"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/app/(app)/logout-button";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/fetch-current-user";

/** Nút tài khoản trên header tablet (component AppHeaderTablet 78:3674). */
export function AccountMenu({ user }: { user: SessionUser }) {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline" size="sm" aria-label={`Tài khoản ${user.username}`} />}>
        <UserRound aria-hidden="true" />
        <ChevronDown aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="flex w-64 flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-(--shadow-card)">
            <div className="px-3 pt-1">
              <p className="truncate font-semibold">{user.member?.fullName ?? user.username}</p>
              <p className="truncate text-sm text-muted-foreground">
                {user.username}
                {user.member ? ` · Đời ${user.member.generation}` : ""}
              </p>
            </div>
            <Popover.Close
              render={<Link href="/account" className="flex h-12 items-center gap-3 rounded-md px-3 font-medium hover:bg-muted" />}
            >
              <UserRound aria-hidden="true" className="size-5" />
              Tài khoản của tôi
            </Popover.Close>
            <LogoutButton variant="menu" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
