"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type PickedMember, pickerKeyAction } from "@/lib/member-form";
import type { Gender, SearchResult } from "@/lib/member-types";

const DEBOUNCE_MS = 250;

const optionDetail = (m: SearchResult) =>
  `Đời ${m.generation}${m.birthYear !== null ? `, sinh ${m.birthYear}` : ""}${m.isDeceased ? ", đã khuất" : ""}`;

// Ô chọn một người CÓ SẴN trong gia phả (combobox theo mẫu ARIA APG). Tạo người mới làm ở trang chi tiết.
export function MemberPicker({
  id,
  label,
  gender,
  excludeId,
  value,
  onChange,
  readOnly = false,
  error,
}: {
  id: string;
  label: string;
  gender?: Gender;
  excludeId?: number;
  value: PickedMember | null;
  onChange: (v: PickedMember | null) => void;
  readOnly?: boolean;
  error?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = `${id}-listbox`;
  const errorId = `${id}-error`;

  useEffect(() => {
    if (value || !q.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: q.trim(), limit: "10" });
      if (gender) params.set("gender", gender);
      if (excludeId !== undefined) params.set("excludeId", String(excludeId));
      try {
        const res = await fetch(`/api/members?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()) as SearchResult[]);
        setActive(-1);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults(null);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, gender, excludeId, value]);

  function choose(m: SearchResult) {
    onChange({ id: m.id, fullName: m.fullName, generation: m.generation });
    setQ("");
    setResults(null);
    setOpen(false);
  }

  const errorText = error && (
    <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  );

  if (value || readOnly) {
    return (
      <div className="flex flex-col gap-2">
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        {value ? (
          <div
            aria-labelledby={`${id}-label`}
            className="flex min-h-14 items-center gap-3 rounded-md border border-input bg-card px-3"
          >
            <MemberAvatar fullName={value.fullName} avatarPath={null} size="sm" />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{value.fullName}</span>
              <span className="text-sm text-muted-foreground">Đời {value.generation}</span>
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={`Bỏ chọn ${label.toLowerCase()}`}
                onClick={() => onChange(null)}
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Chưa có</p>
        )}
        {errorText}
      </div>
    );
  }

  const showList = open && results !== null;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          role="combobox"
          type="text"
          autoComplete="off"
          placeholder="Gõ tên để tìm, có thể gõ không dấu"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) {
              setResults(null);
              setOpen(false);
            }
          }}
          onBlur={() => setOpen(false)}
          onFocus={() => results && setOpen(true)}
          onKeyDown={(e) => {
            const act = pickerKeyAction(e.key, { count: results?.length ?? 0, active, listOpen: showList });
            if (act.preventDefault) e.preventDefault();
            if (act.choose !== undefined && results) choose(results[act.choose]);
            if (act.open !== undefined) setOpen(act.open);
            if (act.active !== undefined) setActive(act.active);
          }}
          className="h-12 w-full min-w-0 rounded-md border border-input bg-card pr-4 pl-11 text-base outline-none placeholder:text-muted-foreground focus-visible:border-2 focus-visible:border-ring aria-invalid:border-destructive"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!showList}
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-card py-1.5 shadow-(--shadow-card)"
        >
          {results?.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">Không tìm thấy. Thêm người mới ở trang chi tiết sau khi lưu.</li>
          )}
          {results?.map((m, i) => (
            <li
              key={m.id}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown thay vì click: chạy trước blur của ô nhập nên danh sách chưa bị đóng.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-center gap-3 px-4 py-2 aria-selected:bg-primary-soft"
            >
              <MemberAvatar fullName={m.fullName} avatarPath={null} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{m.fullName}</span>
                <span className="text-sm text-muted-foreground">{optionDetail(m)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {errorText}
    </div>
  );
}
