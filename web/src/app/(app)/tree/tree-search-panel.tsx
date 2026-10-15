"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchTree } from "@/lib/tree-layout";
import type { TreeData } from "@/lib/tree-types";
import { cn } from "@/lib/utils";

type Props = { data: TreeData; highlightId: number | null; onPick: (memberId: number) => void; className?: string };

/** Ô tìm người trên cây — dùng chung cho dạng cây và dạng danh sách theo nhánh. */
export function TreeSearchPanel({ data, highlightId, onPick, className }: Props) {
  const [query, setQuery] = useState("");
  // Thu danh sách sau khi chọn để không che thẻ vừa căn giữa; sửa ô / focus → mở lại.
  const [open, setOpen] = useState(true);
  const hits = useMemo(() => searchTree(data, query), [data, query]);
  const active = open && query.trim() !== "";
  return (
    <section aria-label="Bảng tìm người" className={cn("rounded-lg border border-border bg-card p-2 shadow-(--shadow-card)", className)}>
      <Label htmlFor="tree-search" className="sr-only">
        Tìm người trên cây
      </Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="tree-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm người trên cây (gõ không dấu)"
          className="pl-10"
        />
      </div>
      {/* Luôn mount để trình đọc màn hình báo khi nội dung đổi. */}
      <p role="status" className={cn("px-1 text-sm text-muted-foreground", active && "mt-2")}>
        {active ? (hits.length > 0 ? `${hits.length} kết quả (tìm không dấu)` : "Không tìm thấy trên cây.") : ""}
      </p>
      {active && hits.length > 0 && (
        <ul data-testid="tree-search-results" className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.memberId}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(h.memberId);
                }}
                aria-current={highlightId === h.memberId}
                className="w-full rounded-md border border-transparent px-2 py-2 text-left hover:bg-muted aria-[current=true]:border-accent aria-[current=true]:bg-accent/15"
              >
                <span className="block font-semibold">{h.fullName}</span>
                <span className="block text-sm text-muted-foreground">
                  Đời {h.generation} — {h.subtitle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
