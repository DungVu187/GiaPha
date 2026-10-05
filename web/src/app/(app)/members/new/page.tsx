import { requireUser } from "@/lib/current-user";
import { emptyMemberForm } from "@/lib/member-form";
import { MemberForm } from "../member-form";

export default async function NewMemberPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return <p>Chỉ quản trị viên được thêm thành viên độc lập. Bạn có thể thêm người thân ở trang chi tiết của mình.</p>;
  }
  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl leading-10 font-semibold">Thêm thành viên</h1>
        <p className="text-lg text-muted-foreground">Trường có dấu * là bắt buộc. Họ tên tự chuyển IN HOA khi lưu.</p>
      </div>
      <MemberForm mode="create" initial={emptyMemberForm()} isAdmin />
    </div>
  );
}
