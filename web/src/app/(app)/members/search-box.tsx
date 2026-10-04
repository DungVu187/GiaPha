"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SearchResult } from "@/lib/member-types";

const DEBOUNCE_MS = 300;

function parentsLine(m: SearchResult): string | null {
  const parents = [m.fatherName, m.motherName].filter(Boolean);
  return parents.length ? `Con của ${parents.join(" và ")}` : null;
}

export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/members?q=${encodeURIComponent(q)}&limit=20`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()) as SearchResult[]);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }, q ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-search">Tìm thành viên</Label>
        <Input
          id="member-search"
          type="search"
          autoComplete="off"
          placeholder="Nhập tên, có thể gõ không dấu"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {failed && <p role="alert" className="font-medium text-destructive">Không tải được danh sách. Vui lòng thử lại.</p>}
      {!failed && results?.length === 0 && <p>Không tìm thấy thành viên nào.</p>}
      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
          {results.map((m) => {
            const parents = parentsLine(m);
            return (
              <li key={m.id}>
                <Link href={`/members/${m.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-primary-soft focus-visible:bg-primary-soft">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{m.fullName}</span>
                    <span className="text-sm text-muted-foreground">Đời {m.generation}</span>
                    {m.isDeceased && <span className="text-xs font-bold tracking-wide text-muted-foreground">ĐÃ KHUẤT</span>}
                  </span>
                  {parents && <span className="text-sm text-muted-foreground">{parents}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
