"use client";

import { ChevronDown, KeyRound, Search, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SuccessNotice } from "@/components/success-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AdminUser, filterUsers, formatDateVN, isRecentClaim } from "@/lib/admin-users";
import { initialOf } from "@/lib/format";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { ROLE_LABEL, RoleDialog } from "./role-dialog";
import { UnlinkDialog } from "./unlink-dialog";

// Cột bảng desktop (Figma 10); dưới lg mỗi dòng là một thẻ (M10 / T10).
const COLS = "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_140px_330px]";
const CHIP = "inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-sm font-medium";

type Dialog = { kind: "reset" | "unlink" | "role"; user: AdminUser } | null;

export function AdminUsers({ users, currentUserId }: { users: AdminUser[]; currentUserId: number }) {
  const [query, setQuery] = useState("");
  const [onlyRecent, setOnlyRecent] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string>();
  // Lấy một lần để lọc "30 ngày" không đổi giữa các lần render.
  const [now] = useState(() => new Date());
  const recentCount = users.filter((u) => isRecentClaim(u.claimedAt, now)).length;
  const shown = filterUsers(users, query, onlyRecent, now);

  const close = () => setDialog(null);
  const done = (message: string) => {
    setNotice(message);
    close();
  };
  // Dữ liệu sau router.refresh() là bản mới; hộp thoại mở luôn dùng bản mới nhất của tài khoản.
  const current = dialog && (users.find((u) => u.id === dialog.user.id) ?? dialog.user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold">Quản trị tài khoản</h1>
        <p className="text-muted-foreground">{users.length} tài khoản. Chỉ Admin thấy trang này.</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-col gap-2 md:flex-1 md:max-w-lg">
          <Label htmlFor="admin-search" className="sr-only">
            Tìm tài khoản
          </Label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên đăng nhập hoặc tên thành viên"
              className="pl-11"
            />
          </div>
        </div>
        <button
          type="button"
          aria-pressed={onlyRecent}
          onClick={() => setOnlyRecent((v) => !v)}
          className="h-12 w-fit shrink-0 whitespace-nowrap rounded-md border border-input bg-card px-4 font-medium hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-accent-text"
        >
          Vừa nhận hồ sơ (30 ngày) · {recentCount}
        </button>
      </div>

      {notice && <SuccessNotice>{notice}</SuccessNotice>}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center font-semibold">Không có tài khoản nào khớp.</p>
      ) : (
        <div className="lg:overflow-hidden lg:rounded-lg lg:border lg:border-border lg:bg-card">
          <div aria-hidden="true" className={`hidden gap-4 bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground lg:grid ${COLS}`}>
            <span>Tên đăng nhập</span>
            <span>Thành viên liên kết</span>
            <span>Email</span>
            <span>Vai trò</span>
            <span>Thao tác</span>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:block">
            {shown.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUserId}
                now={now}
                onOpen={(kind) => setDialog({ kind, user: u })}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Gỡ liên kết: tài khoản vẫn còn, hồ sơ thành viên trở về trạng thái chưa có tài khoản để người đúng nhận lại. Không hạ được quyền Admin cuối cùng.
      </p>

      {dialog && current && dialog.kind === "reset" && <ResetPasswordDialog user={current} onClose={close} onDone={done} />}
      {dialog && current && dialog.kind === "unlink" && <UnlinkDialog user={current} onClose={close} onDone={done} />}
      {dialog && current && dialog.kind === "role" && <RoleDialog user={current} users={users} onClose={close} onDone={done} />}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  now,
  onOpen,
}: {
  user: AdminUser;
  isSelf: boolean;
  now: Date;
  onOpen: (kind: "reset" | "unlink" | "role") => void;
}) {
  const roleLabel = ROLE_LABEL[user.role];
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-lg border border-border bg-card p-5 lg:gap-x-4 lg:rounded-none lg:border-0 lg:border-t lg:px-4 lg:py-3 lg:first:border-t-0 ${COLS}`}
    >
      <span className="min-w-0 font-semibold break-words">
        {user.username}
        {isSelf && <span className="font-normal text-muted-foreground"> (bạn)</span>}
      </span>

      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-span-1">
        {user.member ? (
          <>
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent bg-primary-soft font-heading text-sm font-bold text-accent-text"
            >
              {initialOf(user.member.fullName)}
            </span>
            <div className="flex min-w-0 flex-col lg:gap-0">
              <Link href={`/members/${user.member.id}`} className="font-semibold break-words text-primary hover:underline">
                {user.member.fullName}
              </Link>
              <span className="hidden text-sm text-muted-foreground lg:block">Đời {user.member.generation}</span>
            </div>
            <span className={`${CHIP} bg-accent/30 text-accent-text lg:hidden`}>Đời {user.member.generation}</span>
          </>
        ) : (
          <span className={`${CHIP} bg-secondary text-muted-foreground`}>Chưa liên kết</span>
        )}
        {isRecentClaim(user.claimedAt, now) && user.claimedAt && (
          <span className={`${CHIP} bg-accent/30 text-accent-text`}>Vừa nhận hồ sơ · {formatDateVN(user.claimedAt)}</span>
        )}
      </div>

      <p className="col-span-2 min-w-0 text-sm break-words text-muted-foreground lg:col-span-1 lg:text-base lg:text-foreground">
        <span className="lg:hidden">Email: </span>
        {user.email ?? "—"}
      </p>

      <button
        type="button"
        onClick={() => onOpen("role")}
        aria-label={`Đổi quyền tài khoản ${user.username} (hiện: ${roleLabel})`}
        className="col-start-2 row-start-1 flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 font-medium hover:bg-muted lg:col-start-auto lg:row-start-auto lg:w-full"
      >
        {roleLabel}
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>

      <div className="col-span-2 grid grid-cols-2 gap-2 lg:col-span-1 lg:flex">
        <Button
          variant="outline"
          size="sm"
          disabled={isSelf}
          title={isSelf ? "Đổi mật khẩu của bạn ở Tài khoản của tôi" : undefined}
          onClick={() => onOpen("reset")}
        >
          <KeyRound aria-hidden="true" className="hidden lg:block" />
          Đặt lại mật khẩu
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!user.member}
          onClick={() => onOpen("unlink")}
          className="border-destructive text-destructive hover:bg-primary-soft hover:text-destructive"
        >
          <Unlink aria-hidden="true" className="hidden lg:block" />
          Gỡ liên kết
        </Button>
      </div>
    </li>
  );
}
