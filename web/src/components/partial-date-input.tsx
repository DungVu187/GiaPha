"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPartialDate } from "@/lib/format";
import { parseNumberField } from "@/lib/member-form";

type Part = "day" | "month" | "year";
const PARTS: { key: Part; label: string; maxLength: number; width: string }[] = [
  { key: "day", label: "Ngày", maxLength: 2, width: "w-24" },
  { key: "month", label: "Tháng", maxLength: 2, width: "w-24" },
  { key: "year", label: "Năm", maxLength: 4, width: "w-34" },
];

const asNumber = (v: string) => {
  const n = parseNumberField(v);
  return typeof n === "number" ? n : n === null ? null : undefined;
};

// Chỉ xem trước khi các ô đúng hình dạng; server mới kiểm ngày có thật hay không.
function preview(day: string, month: string, year: string): string {
  const d = asNumber(day);
  const m = asNumber(month);
  const y = asNumber(year);
  if (d === undefined || m === undefined || y === undefined || y === null) return "";
  if (d !== null && m === null) return "";
  return formatPartialDate({ year: y, month: m, day: d });
}

export function PartialDateInput({
  legend,
  idPrefix,
  day,
  month,
  year,
  onChange,
  error,
}: {
  legend: string;
  idPrefix: string;
  day: string;
  month: string;
  year: string;
  onChange: (v: { day: string; month: string; year: string }) => void;
  error?: string;
}) {
  const values = { day, month, year };
  const shown = preview(day, month, year);
  const errorId = `${idPrefix}-error`;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {PARTS.map((p) => (
          <div key={p.key} className={`flex flex-col gap-2 ${p.width}`}>
            <Label htmlFor={`${idPrefix}-${p.key}`}>{p.label}</Label>
            <Input
              id={`${idPrefix}-${p.key}`}
              inputMode="numeric"
              autoComplete="off"
              maxLength={p.maxLength}
              value={values[p.key]}
              onChange={(e) => onChange({ ...values, [p.key]: e.target.value })}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
        ))}
      </div>
      {shown && <p className="text-sm text-muted-foreground">Hiển thị: {shown}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
