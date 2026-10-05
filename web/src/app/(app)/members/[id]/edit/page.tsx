import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/current-user";
import { memberFormFromDetail } from "@/lib/member-form";
import type { MemberDetail } from "@/lib/member-types";
import { MemberForm } from "../../member-form";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const user = await requireUser();
  const d = await apiGet<MemberDetail>(`/api/members/${id}`);
  if (!d) notFound();
  if (!d.permissions.canEdit) return <p>Bạn không có quyền sửa thành viên này.</p>;
  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl leading-10 font-semibold">Sửa thông tin</h1>
        <p className="text-lg text-muted-foreground">Trường có dấu * là bắt buộc. Họ tên tự chuyển IN HOA khi lưu.</p>
      </div>
      <MemberForm
        mode="edit"
        memberId={d.id}
        initial={memberFormFromDetail(d)}
        generationLockedBySpouse={d.generationLocked && !d.father && !d.mother ? { generation: d.generation } : null}
        canChangeParents={user.role === "ADMIN"}
      />
    </div>
  );
}
