"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DeceasedBadge } from "@/components/deceased-badge";
import { Highlight } from "@/components/highlight";
import { MemberAvatar } from "@/components/member-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { directoryQuery, groupByGeneration } from "@/lib/directory";
import { formatPartialDate } from "@/lib/format";
import type { SearchResult } from "@/lib/member-types";

const DEBOUNCE_MS = 300;
// Cột bảng: Họ tên | Đời | Bố | Xem (tablet); thêm Ngày sinh, Mẹ (desktop) — Figma 05 / T5.
const COLS =
  "md:grid-cols-[minmax(0,2.2fr)_64px_minmax(0,1.4fr)_48px] lg:grid-cols-[minmax(0,2.2fr)_64px_110px_minmax(0,1.4fr)_minmax(0,1.4fr)_48px]";

type Props = {
  generations: number[];
  initialQuery: string;
  initialGeneration: number | null;
  initialRows: SearchResult[];
};

export function MemberDirectory({ generations, initialQuery, initialGeneration, initialRows }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [generation, setGeneration] = useState(initialGeneration);
  const [rows, setRows] = useState(initialRows);
  // Bộ lọc ứng với `rows` đang hiện (để dòng tóm tắt và chữ tô khớp đúng kết quả, không nhảy theo từng phím gõ).
  const [shown, setShown] = useState({ q: initialQuery, generation: initialGeneration });
  const [failed, setFailed] = useState(false);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false; // lần đầu đã có dữ liệu từ server
      return;
    }
    const query = q.trim();
    const qs = directoryQuery(query, generation);
    window.history.replaceState(null, "", `/members${qs}`);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/members/directory${qs}`, { signal: controller.signal });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as SearchResult[];
        if (controller.signal.aborted) return;
        setRows(data);
        setShown({ q: query, generation });
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, generation, router]);

  const summary = shown.q
    ? `${rows.length} kết quả cho “${shown.q}” — khớp tên hoặc tên bố/mẹ, xếp theo đời`
    : shown.generation !== null
      ? `${rows.length} thành viên đời ${shown.generation}`
      : `${rows.length} thành viên, xếp theo đời`;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Tìm và lọc" className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-search">Tìm theo tên, tên bố hoặc tên mẹ</Label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="member-search"
              type="search"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nhập tên, có thể gõ không dấu"
              aria-describedby="member-search-hint"
              className="pl-11"
            />
          </div>
          <p id="member-search-hint" className="text-sm text-muted-foreground">
            Gõ không dấu cũng tìm được. Ví dụ: “vu van”.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <span id="generation-filter" className="shrink-0 font-medium">
            Lọc theo đời
          </span>
          <div
            role="group"
            aria-labelledby="generation-filter"
            className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1 md:flex-wrap"
          >
            {[null, ...generations].map((g) => (
              <button
                key={g ?? "all"}
                type="button"
                aria-pressed={generation === g}
                onClick={() => setGeneration(g)}
                className="h-10 shrink-0 rounded-md px-4 font-medium text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
              >
                {g === null ? "Tất cả" : `Đời ${g}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p role="status" className="text-muted-foreground">
        {summary}
      </p>
      {failed && (
        <p role="alert" className="font-medium text-destructive">
          Không tải được danh sách. Vui lòng thử lại.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-8 text-center">
          <p className="font-semibold">Không tìm thấy thành viên nào.</p>
          <p className="text-sm text-muted-foreground">Thử gõ không dấu, gõ ít chữ hơn hoặc chọn “Tất cả” đời.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div aria-hidden="true" className={`hidden gap-4 bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground md:grid ${COLS}`}>
            <span>Họ và tên</span>
            <span>Đời</span>
            <span className="hidden lg:block">Ngày sinh</span>
            <span>Bố</span>
            <span className="hidden lg:block">Mẹ</span>
            <span />
          </div>
          {groupByGeneration(rows).map((g) => (
            <section key={g.generation} aria-labelledby={`gen-${g.generation}`}>
              <h2
                id={`gen-${g.generation}`}
                className="border-t border-border bg-secondary/60 px-4 py-2 font-heading text-lg font-semibold text-accent-text"
              >
                Đời {g.generation}{" "}
                <span className="font-sans text-sm font-normal text-muted-foreground">({g.members.length})</span>
              </h2>
              <ul>
                {g.members.map((m) => (
                  <DirectoryRow key={m.id} m={m} q={shown.q} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectoryRow({ m, q }: { m: SearchResult; q: string }) {
  const birth = formatPartialDate({ year: m.birthYear, month: m.birthMonth, day: m.birthDay });
  const parents = [m.fatherName, m.motherName].filter((n): n is string => n !== null);
  return (
    <li className="border-t border-border">
      <Link
        href={`/members/${m.id}`}
        aria-label={`${m.fullName}, đời ${m.generation}${m.isDeceased ? ", đã khuất" : ""}`}
        className="block px-4 py-3 hover:bg-primary-soft focus-visible:bg-primary-soft"
      >
        {/* Điện thoại (Figma M6): ĐÃ KHUẤT luôn ở dòng riêng dưới tên (review Figma #6). */}
        <span className="flex items-center gap-3 md:hidden">
          <MemberAvatar fullName={m.fullName} avatarPath={m.avatarPath} size="sm" alt="" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">
                <Highlight text={m.fullName} query={q} />
              </span>
              <span className="text-sm text-muted-foreground">Đời {m.generation}</span>
            </span>
            {m.isDeceased && <DeceasedBadge />}
            {parents.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Con của{" "}
                {parents.map((p, i) => (
                  <span key={i}>
                    {i > 0 && " và "}
                    <Highlight text={p} query={q} />
                  </span>
                ))}
              </span>
            )}
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
        </span>
        <span className={`hidden items-center gap-4 md:grid ${COLS}`}>
          <span className="flex min-w-0 items-center gap-3">
            <MemberAvatar fullName={m.fullName} avatarPath={m.avatarPath} size="sm" alt="" />
            <span className="font-heading font-semibold">
              <Highlight text={m.fullName} query={q} />
            </span>
            {m.isDeceased && <DeceasedBadge />}
          </span>
          <span>Đời {m.generation}</span>
          <span className="hidden lg:block">{birth || "—"}</span>
          <span className="truncate">{m.fatherName ? <Highlight text={m.fatherName} query={q} /> : "—"}</span>
          <span className="hidden truncate lg:block">{m.motherName ? <Highlight text={m.motherName} query={q} /> : "—"}</span>
          <span className="font-semibold text-primary underline underline-offset-4">Xem</span>
        </span>
      </Link>
    </li>
  );
}
