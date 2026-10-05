"use client";

import { Check, CircleAlert, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MemberPicker } from "@/components/member-picker";
import { PartialDateInput } from "@/components/partial-date-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type MemberFormState,
  parentGenerationPreview,
  parseNumberField,
  toMemberBody,
} from "@/lib/member-form";
import type { CalendarType } from "@/lib/member-types";
import { formatAnniversaryLong } from "@/lib/format";
import { normalizeFullName } from "@/lib/name";

type Errors = Partial<Record<string, string>>;
type Suggestion = { day: number; month: number; calendar: CalendarType };

const SUGGEST_DEBOUNCE_MS = 400;

// Khóa lỗi của API (theo thứ tự trên form) → id ô nhận focus.
const ERROR_FOCUS: [string, string][] = [
  ["fullName", "fullName"],
  ["gender", "gender-MALE"],
  ["generation", "generation"],
  ["birthOrder", "birthOrder"],
  ["birthDate", "birth-day"],
  ["isDeceased", "status-alive"],
  ["deathDate", "death-day"],
  ["deathCalendar", "deathCalendar-SOLAR"],
  ["deathLunarLeap", "deathLunarLeap"],
  ["anniversary", "anniversary-day"],
  ["burialPlace", "burialPlace"],
  ["fatherId", "father"],
  ["motherId", "mother"],
  ["note", "note"],
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-2xl leading-8 font-semibold">{title}</h2>
        {hint && <p className="text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;
}

// Nhóm nút bật/tắt kiểu "segmented" (Figma SegmentItem), mỗi nút có aria-pressed.
export function Segmented<T extends string>({
  label,
  idPrefix,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  idPrefix: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <div role="group" aria-labelledby={`${idPrefix}-label`} className="flex flex-col gap-2">
      <span id={`${idPrefix}-label`} className="font-medium">
        {label}
      </span>
      <div className="flex w-fit gap-0.5 rounded-md bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.value}
            id={`${idPrefix}-${o.value}`}
            type="button"
            aria-pressed={value === o.value}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
            onClick={() => onChange(o.value)}
            className="h-10 rounded-sm px-4 font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-[0_1px_1px_rgb(36_28_23/0.12)]"
          >
            {o.label}
          </button>
        ))}
      </div>
      <FieldError id={`${idPrefix}-error`} error={error} />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  className,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  className?: string;
} & Omit<React.ComponentProps<"input">, "onChange" | "value" | "id">) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

export function MemberForm({
  mode,
  memberId,
  initial,
  generationLockedBySpouse = null,
  canChangeParents,
}: {
  mode: "create" | "edit";
  memberId?: number;
  initial: MemberFormState;
  generationLockedBySpouse?: { generation: number } | null;
  // R12: chỉ admin đổi bố/mẹ (API trả 403 nếu người khác gửi bố/mẹ khác giá trị đang lưu).
  canChangeParents: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof MemberFormState>(key: K, v: MemberFormState[K]) => setS((p) => ({ ...p, [key]: v }));

  const parentGeneration = parentGenerationPreview(s);
  const spouseGeneration = parentGeneration === null ? generationLockedBySpouse?.generation ?? null : null;
  const generationLocked = parentGeneration !== null || spouseGeneration !== null;
  const normalized = normalizeFullName(s.fullName);
  const backHref = mode === "edit" ? `/members/${memberId}` : "/members";

  // Gợi ý ngày giỗ từ ngày mất (server tính bằng lịch âm). Lỗi → chỉ ẩn gợi ý.
  const { isDeceased, deathCalendar, deathDay, deathMonth, deathYear } = s;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (!isDeceased || ![deathDay, deathMonth, deathYear].some((v) => v.trim())) {
          setSuggestion(null);
          return;
        }
        const params = new URLSearchParams({
          calendar: deathCalendar,
          year: deathYear.trim(),
          month: deathMonth.trim(),
          day: deathDay.trim(),
        });
        try {
          const res = await fetch(`/api/calendar/anniversary-suggestion?${params}`, { signal: controller.signal });
          const body = res.ok ? ((await res.json()) as { suggestion: Suggestion | null }) : null;
          setSuggestion(body?.suggestion ?? null);
        } catch {
          if (!controller.signal.aborted) setSuggestion(null);
        }
      },
      SUGGEST_DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isDeceased, deathCalendar, deathDay, deathMonth, deathYear]);

  const suggestionDiffers =
    suggestion !== null &&
    (parseNumberField(s.anniversaryDay) !== suggestion.day ||
      parseNumberField(s.anniversaryMonth) !== suggestion.month ||
      s.anniversaryCalendar !== suggestion.calendar);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setErrors({});
    // Đời bị khóa thì server tự suy ra; không gửi giá trị cũ trong ô ẩn.
    const body = toMemberBody(generationLocked ? { ...s, generation: "" } : s);
    try {
      const res = await fetch(mode === "create" ? "/api/members" : `/api/members/${memberId}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const id = mode === "create" ? ((await res.json()) as { id: number }).id : memberId;
        router.push(`/members/${id}`);
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { message?: unknown; errors?: unknown } | null;
      if (res.status === 400 && data?.errors && typeof data.errors === "object") {
        const fieldErrors = data.errors as Errors;
        setErrors(fieldErrors);
        setFormError("Vui lòng kiểm tra các ô được đánh dấu.");
        const first = ERROR_FOCUS.find(([key, id]) => fieldErrors[key] && document.getElementById(id));
        // Đợi React vẽ lỗi rồi mới focus.
        setTimeout(() => (first ? document.getElementById(first[1])?.focus() : alertRef.current?.focus()));
      } else {
        setFormError(typeof data?.message === "string" ? data.message : "Lưu thất bại, vui lòng thử lại.");
        setTimeout(() => alertRef.current?.focus());
      }
    } catch {
      setFormError("Không kết nối được máy chủ.");
      setTimeout(() => alertRef.current?.focus());
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="flex items-center gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive outline-none"
        >
          <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
          <p>{formError}</p>
        </div>
      )}

      <Section title="Thông tin cơ bản">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Họ và tên *</Label>
          <Input
            id="fullName"
            autoComplete="off"
            maxLength={100}
            value={s.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={[normalized && "fullName-preview", errors.fullName && "fullName-error"].filter(Boolean).join(" ") || undefined}
          />
          {normalized && (
            <p id="fullName-preview" className="text-sm text-muted-foreground">
              Sẽ lưu thành: {normalized}
            </p>
          )}
          <FieldError id="fullName-error" error={errors.fullName} />
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
          <Segmented
            label="Giới tính"
            idPrefix="gender"
            options={[
              { value: "MALE", label: "Nam" },
              { value: "FEMALE", label: "Nữ" },
            ]}
            value={s.gender}
            onChange={(g) => set("gender", s.gender === g ? null : g)}
            error={errors.gender}
          />
          {generationLocked ? (
            <div className="flex flex-col gap-2">
              <span className="font-medium">Đời *</span>
              <p className="flex min-h-12 flex-wrap items-center gap-3 rounded-md bg-muted px-4">
                <span className="rounded-sm bg-primary-soft px-2 py-0.5 text-sm font-medium text-accent-text">
                  Đời {parentGeneration ?? spouseGeneration}
                </span>
                <span className="text-muted-foreground">
                  {parentGeneration !== null ? "Tự tính từ bố/mẹ" : "Theo vợ/chồng"}
                </span>
              </p>
              <FieldError id="generation-error" error={errors.generation} />
            </div>
          ) : (
            <TextField
              id="generation"
              label="Đời *"
              className="sm:w-40"
              inputMode="numeric"
              maxLength={3}
              required
              value={s.generation}
              onChange={(v) => set("generation", v)}
              error={errors.generation}
            />
          )}
        </div>

        <TextField
          id="birthOrder"
          label="Thứ tự trong anh chị em"
          className="sm:w-64"
          inputMode="numeric"
          maxLength={2}
          value={s.birthOrder}
          onChange={(v) => set("birthOrder", v)}
          hint="Không bắt buộc. Dùng để xếp con trên cây."
          error={errors.birthOrder}
        />
      </Section>

      <Section title="Ngày sinh" hint="Không nhớ rõ? Có thể chỉ nhập năm, hoặc tháng và năm.">
        <PartialDateInput
          legend="Ngày sinh (dương lịch)"
          idPrefix="birth"
          day={s.birthDay}
          month={s.birthMonth}
          year={s.birthYear}
          onChange={(d) => setS((p) => ({ ...p, birthDay: d.day, birthMonth: d.month, birthYear: d.year }))}
          error={errors.birthDate}
        />
      </Section>

      <Section title="Trạng thái">
        <div role="group" aria-label="Trạng thái" className="flex w-fit gap-0.5 rounded-md bg-muted p-1">
          {[
            { id: "status-alive", label: "Còn sống", value: false },
            { id: "status-deceased", label: "Đã khuất", value: true },
          ].map((o) => (
            <button
              key={o.id}
              id={o.id}
              type="button"
              aria-pressed={s.isDeceased === o.value}
              onClick={() => set("isDeceased", o.value)}
              className="h-10 rounded-sm px-4 font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-[0_1px_1px_rgb(36_28_23/0.12)]"
            >
              {o.label}
            </button>
          ))}
        </div>
        <FieldError id="isDeceased-error" error={errors.isDeceased} />

        {s.isDeceased && (
          <div className="flex flex-col gap-5 rounded-md border border-border bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
              <PartialDateInput
                legend="Ngày mất"
                idPrefix="death"
                day={s.deathDay}
                month={s.deathMonth}
                year={s.deathYear}
                onChange={(d) => setS((p) => ({ ...p, deathDay: d.day, deathMonth: d.month, deathYear: d.year }))}
                error={errors.deathDate}
              />
              <Segmented
                label="Theo lịch"
                idPrefix="deathCalendar"
                options={[
                  { value: "SOLAR", label: "Dương lịch" },
                  { value: "LUNAR", label: "Âm lịch" },
                ]}
                value={s.deathCalendar}
                onChange={(c) => set("deathCalendar", c)}
                error={errors.deathCalendar}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex w-fit items-center gap-2 has-disabled:opacity-50">
                <input
                  id="deathLunarLeap"
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={s.deathCalendar === "LUNAR" && s.deathLunarLeap}
                  disabled={s.deathCalendar !== "LUNAR"}
                  onChange={(e) => set("deathLunarLeap", e.target.checked)}
                  aria-invalid={errors.deathLunarLeap ? true : undefined}
                  aria-describedby={errors.deathLunarLeap ? "deathLunarLeap-error" : undefined}
                />
                Tháng nhuận (chỉ khi chọn âm lịch)
              </label>
              <FieldError id="deathLunarLeap-error" error={errors.deathLunarLeap} />
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 font-medium">Ngày giỗ (ngày/tháng)</legend>
                <div className="flex gap-3">
                  {(
                    [
                      ["anniversary-day", "Ngày", "anniversaryDay"],
                      ["anniversary-month", "Tháng", "anniversaryMonth"],
                    ] as const
                  ).map(([id, label, key]) => (
                    <div key={id} className="flex w-24 flex-col gap-2">
                      <Label htmlFor={id}>{label}</Label>
                      <Input
                        id={id}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={2}
                        value={s[key]}
                        onChange={(e) => set(key, e.target.value)}
                        aria-invalid={errors.anniversary ? true : undefined}
                        aria-describedby={errors.anniversary ? "anniversary-error" : undefined}
                      />
                    </div>
                  ))}
                </div>
                <FieldError id="anniversary-error" error={errors.anniversary} />
              </fieldset>
              <Segmented
                label="Theo lịch"
                idPrefix="anniversaryCalendar"
                options={[
                  { value: "LUNAR", label: "Âm lịch" },
                  { value: "SOLAR", label: "Dương lịch" },
                ]}
                value={s.anniversaryCalendar}
                onChange={(c) => set("anniversaryCalendar", c)}
              />
            </div>

            {suggestion && suggestionDiffers && (
              <div className="flex flex-col gap-3 rounded-md border border-accent bg-accent/15 px-4 py-3 sm:flex-row sm:items-center">
                <Lightbulb aria-hidden="true" className="size-5 shrink-0 text-accent-text" />
                <p className="flex-1 font-medium">
                  Gợi ý từ ngày mất: giỗ ngày {formatAnniversaryLong(suggestion.day, suggestion.month, suggestion.calendar)}.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setS((p) => ({
                      ...p,
                      anniversaryDay: String(suggestion.day),
                      anniversaryMonth: String(suggestion.month),
                      anniversaryCalendar: suggestion.calendar,
                    }))
                  }
                >
                  Dùng gợi ý
                </Button>
              </div>
            )}

            <TextField
              id="burialPlace"
              label="Nơi an táng"
              maxLength={200}
              value={s.burialPlace}
              onChange={(v) => set("burialPlace", v)}
              error={errors.burialPlace}
            />
          </div>
        )}
        <p className="text-sm text-muted-foreground">Chọn &quot;Còn sống&quot; thì ẩn ngày mất, ngày giỗ, nơi an táng.</p>
      </Section>

      <Section title="Quan hệ gia đình">
        <MemberPicker
          id="father"
          label="Bố"
          gender="MALE"
          excludeId={memberId}
          value={s.father}
          onChange={(v) => set("father", v)}
          readOnly={!canChangeParents}
          error={errors.fatherId}
        />
        <MemberPicker
          id="mother"
          label="Mẹ"
          gender="FEMALE"
          excludeId={memberId}
          value={s.mother}
          onChange={(v) => set("mother", v)}
          readOnly={!canChangeParents}
          error={errors.motherId}
        />
        <p className="text-sm text-muted-foreground">
          {canChangeParents
            ? "Chỉ hiện nam cho ô Bố, nữ cho ô Mẹ. Thêm vợ/chồng, con hoặc tạo người mới ở trang chi tiết."
            : "Chỉ quản trị viên được đổi bố/mẹ. Thêm vợ/chồng, con hoặc tạo người mới ở trang chi tiết."}
        </p>
      </Section>

      <Section title="Ghi chú">
        <div className="flex flex-col gap-2">
          <Label htmlFor="note">Ghi chú</Label>
          <textarea
            id="note"
            rows={4}
            maxLength={2000}
            placeholder="Ví dụ: tiểu sử, công việc, nơi sinh sống…"
            value={s.note}
            onChange={(e) => set("note", e.target.value)}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? "note-error" : undefined}
            className="w-full rounded-md border border-input bg-card px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
          />
          <FieldError id="note-error" error={errors.note} />
        </div>
      </Section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
          Hủy
        </Link>
        <Button type="submit" disabled={pending}>
          <Check aria-hidden="true" className="size-5" />
          {pending ? "Đang lưu..." : "Lưu thành viên"}
        </Button>
      </div>
    </form>
  );
}
