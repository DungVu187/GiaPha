import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { AdminUser } from "@/lib/admin-users";
import { requireUser } from "@/lib/current-user";
import { AdminUsers } from "./admin-users";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="font-heading text-2xl font-semibold">Không có quyền</h1>
        <p className="text-muted-foreground">Trang này chỉ dành cho quản trị viên.</p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Về trang chủ
        </Link>
      </div>
    );
  }
  const users = (await apiGet<AdminUser[]>("/api/admin/users")) ?? [];
  return <AdminUsers users={users} currentUserId={user.id} />;
}
