"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MemberPicker } from "@/components/member-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { genderLabel } from "@/lib/format";
import type { PickedMember } from "@/lib/member-form";
import type { Gender } from "@/lib/member-types";
import { normalizeFullName } from "@/lib/name";
import { type NewRelativeState, type RelationKind, relationTitle, relativeBody, relativeGender } from "@/lib/relative-form";
import { Segmented } from "../member-form";

type Tab = "existing" | "created";
type Spouse = { id: number; fullName: string };

const tabClass =
  "h-10 rounded-sm px-4 font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring data-active:bg-card data-active:font-semibold data-active:text-foreground data-active:shadow-[0_1px_1px_rgb(36_28_23/0.12)]";

const emptyNew = (gender: Gender | null, otherParentId: number | null): NewRelativeState => ({
  fullName: "",
  gender,
  birthYear: "",
  isDeceased: false,
  otherParentId,
});

export function RelativeDialog({
  memberId,
  personGender,
  relation,
  canPickExisting,
  spouses,
}: {
  memberId: number;
  personGender: Gender | null;
  relation: RelationKind;
  // R12: chỉ admin chọn người có sẵn (API trả 403 với người khác).
  canPickExisting: boolean;
  // Thêm con: bố/mẹ còn lại chỉ chọn trong số vợ/chồng hiện tại.
  spouses: Spouse[];
}) {
  const router = useRouter();
  const title = relationTitle(relation, personGender);
  const lockedGender = relativeGender(relation, personGender);
  const defaultOther = spouses.length === 1 ? spouses[0].id : null;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(canPickExisting ? "existing" : "created");
  const [existing, setExisting] = useState<PickedMember | null>(null);
  const [created, setCreated] = useState<NewRelativeState>(() => emptyNew(lockedGender, defaultOther));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof NewRelativeState>(k: K, v: NewRelativeState[K]) => setCreated((p) => ({ ...p, [k]: v }));
  const normalized = normalizeFullName(created.fullName);
  const otherParentLabel = personGender === "MALE" ? "Mẹ" : personGender === "FEMALE" ? "Bố" : null;
  const showOtherParent = relation === "CHILD" && otherParentLabel !== null && spouses.length > 0;

  // Làm mới khi mở: danh sách vợ/chồng có thể đã đổi (router.refresh) kể từ lần render đầu.
  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setTab(canPickExisting ? "existing" : "created");
      setExisting(null);
      setCreated(emptyNew(lockedGender, defaultOther));
      setErrors([]);
    }
  }

  async function submit() {
    if (tab === "existing" && !existing) {
      setErrors(["Vui lòng chọn một người."]);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const choice = tab === "existing" && existing ? { existing } : { created };
      const res = await fetch(`/api/members/${memberId}/relatives`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(relativeBody(relation, choice, personGender)),
      });
      if (res.status === 201) {
        onOpenChange(false);
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { message?: unknown; errors?: unknown } | null;
      if (res.status === 400 && data?.errors && typeof data.errors === "object") {
        setErrors(Object.values(data.errors as Record<string, unknown>).filter((v): v is string => typeof v === "string"));
      } else if (typeof data?.message === "string" && [400, 403, 404, 409].includes(res.status)) {
        setErrors([data.message]);
      } else {
        setErrors(["Thêm thất bại, vui lòng thử lại."]);
      }
    } catch {
      setErrors(["Không kết nối được máy chủ."]);
    } finally {
      setBusy(false);
    }
  }

  const newForm = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="relative-fullName">Họ và tên *</Label>
        <Input
          id="relative-fullName"
          autoComplete="off"
          maxLength={100}
          value={created.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          aria-describedby={normalized ? "relative-fullName-preview" : undefined}
        />
        {normalized && (
          <p id="relative-fullName-preview" className="text-sm text-muted-foreground">
            Sẽ lưu thành: {normalized}
          </p>
        )}
      </div>
      {lockedGender ? (
        <div className="flex flex-col gap-2">
          <span className="font-medium">Giới tính</span>
          <p className="flex min-h-12 items-center rounded-md bg-muted px-4">{genderLabel(lockedGender)}</p>
        </div>
      ) : (
        <Segmented
          label="Giới tính"
          idPrefix="relative-gender"
          options={[
            { value: "MALE", label: "Nam" },
            { value: "FEMALE", label: "Nữ" },
          ]}
          value={created.gender}
          onChange={(g) => set("gender", created.gender === g ? null : g)}
        />
      )}
      <div className="flex flex-col gap-2 sm:w-40">
        <Label htmlFor="relative-birthYear">Năm sinh</Label>
        <Input
          id="relative-birthYear"
          inputMode="numeric"
          maxLength={4}
          value={created.birthYear}
          onChange={(e) => set("birthYear", e.target.value)}
        />
      </div>
      <Segmented
        label="Trạng thái"
        idPrefix="relative-status"
        options={[
          { value: "alive", label: "Còn sống" },
          { value: "deceased", label: "Đã khuất" },
        ]}
        value={created.isDeceased ? "deceased" : "alive"}
        onChange={(v) => set("isDeceased", v === "deceased")}
      />
      {showOtherParent && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="relative-otherParent">{otherParentLabel}</Label>
          <select
            id="relative-otherParent"
            value={created.otherParentId ?? ""}
            onChange={(e) => set("otherParentId", e.target.value ? Number(e.target.value) : null)}
            className="h-12 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:border-2 focus-visible:border-ring"
          >
            <option value="">Chưa rõ</option>
            {spouses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-sm text-muted-foreground">Đời được tính tự động. Thông tin khác sửa sau ở trang của người này.</p>
    </div>
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger render={<Button variant="outline" />}>{title}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl bg-card p-6 shadow-(--shadow-card)">
          <Dialog.Title className="font-heading text-xl font-semibold">{title}</Dialog.Title>
          {canPickExisting ? (
            <Tabs.Root value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col gap-5">
              <Tabs.List className="flex w-fit gap-0.5 rounded-md bg-muted p-1">
                <Tabs.Tab value="existing" className={tabClass}>
                  Chọn người có sẵn
                </Tabs.Tab>
                <Tabs.Tab value="created" className={tabClass}>
                  Tạo người mới
                </Tabs.Tab>
              </Tabs.List>
              {/* Chừa chỗ cho danh sách gợi ý (absolute) khỏi bị khung cuộn của hộp thoại che. */}
              <Tabs.Panel value="existing" className="min-h-80">
                <MemberPicker
                  id="relative-existing"
                  label="Người có sẵn"
                  gender={lockedGender ?? undefined}
                  excludeId={memberId}
                  value={existing}
                  onChange={setExisting}
                />
              </Tabs.Panel>
              <Tabs.Panel value="created">{newForm}</Tabs.Panel>
            </Tabs.Root>
          ) : (
            newForm
          )}
          {errors.length > 0 && (
            <div role="alert" className="flex flex-col gap-1 font-medium text-destructive">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Dialog.Close render={<Button variant="outline" />}>Đóng</Dialog.Close>
            <Button onClick={submit} disabled={busy}>
              Thêm
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
