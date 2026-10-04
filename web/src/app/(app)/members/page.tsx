import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/current-user";
import { SearchBox } from "./search-box";

export default async function MembersPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl leading-8 font-semibold">Thành viên</h1>
        {user.role === "ADMIN" && (
          <Link href="/members/new" className={buttonVariants()}>
            Thêm thành viên
          </Link>
        )}
      </div>
      <SearchBox />
    </div>
  );
}
