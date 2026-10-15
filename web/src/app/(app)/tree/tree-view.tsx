"use client";

import "@xyflow/react/dist/style.css";
import { ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import { List, Maximize, Minus, Network, Plus, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ancestorFamilyIds, familyIdOf, initialView, layoutTree, type TreeLayout } from "@/lib/tree-layout";
import type { TreeData } from "@/lib/tree-types";
import { cn } from "@/lib/utils";
import { FamilyNode, type FamilyFlowNode } from "./family-node";
import { TreeSearchPanel } from "./tree-search-panel";

type BandNode = Node<{ width: number; height: number; odd: boolean }, "band">;

// Nền dải đời (toạ độ cây). Nhãn "Đời N" vẽ ở BandLabels để ghim mép trái khung nhìn.
function Band({ data }: NodeProps<BandNode>) {
  return <div className={cn("border-t border-border/60", data.odd && "bg-secondary/40")} style={{ width: data.width, height: data.height }} />;
}

const nodeTypes = { family: FamilyNode, band: Band };
// "Vừa màn hình" chừa chỗ cho bảng tìm (trên) và nút zoom (dưới) — lỗi test thực tế: bảng tìm che khối gốc.
const FIT_OPTS = { padding: { top: "96px", right: "24px", bottom: "96px", left: "80px" } } as const;
const LABEL_H = 56;
// Vùng nhãn đời không bị che: dưới bảng tìm (top 12 + cao ~58) và trên cụm nút zoom (bottom 12 + cao ~148).
const SAFE_TOP = 80;
const SAFE_BOTTOM = 170;

function ZoomLevel() {
  const zoom = useStore((s) => s.transform[2]);
  return (
    <span data-testid="zoom-level" className="border-t border-border px-1 py-1 text-center text-xs">
      {Math.round(zoom * 100)}%
    </span>
  );
}

/** Nhãn "Đời N" ghim mép trái, chạy dọc theo dải đời khi kéo / zoom. */
function BandLabels({ bands }: { bands: TreeLayout["bands"] }) {
  const [, ty, zoom] = useStore((s) => s.transform);
  const viewH = useStore((s) => s.height);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[72px] overflow-hidden">
      {bands.map((b) => {
        const top = b.y * zoom + ty;
        const bottom = top + b.height * zoom;
        const y = Math.min(Math.max(top, SAFE_TOP), Math.min(bottom, viewH - SAFE_BOTTOM) - LABEL_H);
        // Dải đời nằm hẳn trong vùng bị che (hoặc ngoài khung) → không vẽ nhãn.
        if (top > viewH - SAFE_BOTTOM || y < SAFE_TOP) return null;
        return (
          <div key={b.generation} data-band={b.generation} className="absolute left-2" style={{ top: y + 8 }}>
            <span className="block rounded-md bg-card/90 px-2 py-1 text-center font-heading leading-tight text-muted-foreground shadow-sm">
              Đời<span className="block text-2xl text-foreground">{b.generation}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const HINT_KEY = "giapha.treeHintDismissed";
const hintListeners = new Set<() => void>();
function subscribeHint(cb: () => void) {
  hintListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    hintListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function useHintDismissed(): [boolean, () => void] {
  const dismissed = useSyncExternalStore(subscribeHint, () => localStorage.getItem(HINT_KEY) === "1", () => true);
  const dismiss = () => {
    localStorage.setItem(HINT_KEY, "1");
    hintListeners.forEach((l) => l());
  };
  return [dismissed, dismiss];
}

type Props = { data: TreeData; myMemberId: number | null; focusId: number | null };

function TreeCanvas({ data, myMemberId, focusId }: Props) {
  const { setCenter, zoomIn, zoomOut, fitView } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const focusFamily = focusId !== null ? familyIdOf(data, focusId) : null;
  const myFamily = myMemberId !== null ? familyIdOf(data, myMemberId) : null;
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [highlightId, setHighlightId] = useState<number | null>(focusFamily !== null ? focusId : null);
  const [missingClosed, setMissingClosed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hintDismissed, dismissHint] = useHintDismissed();

  const layout = useMemo(() => layoutTree(data, collapsed), [data, collapsed]);
  const byId = useMemo(() => new Map(data.families.map((f) => [f.id, f])), [data]);

  const toggle = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Điểm mở trang (P7) — tính khi React Flow sẵn sàng, theo kích thước khung thật.
  function onInit(rf: ReactFlowInstance<FamilyFlowNode | BandNode>) {
    const box = wrapRef.current!.getBoundingClientRect();
    const v = initialView(layout, {
      focusFamilyId: focusFamily,
      homeFamilyId: myFamily,
      // Trừ phần đệm của FIT_OPTS (trái 80 + phải 24, trên 96 + dưới 96) để "vừa màn hình" thật sự ≥ 60%.
      viewport: { width: box.width - 104, height: box.height - 192 },
    });
    if (v.kind === "fit") void rf.fitView(FIT_OPTS);
    else void rf.setCenter(v.x, v.y, { zoom: 1 });
  }

  // Mở nhánh tổ tiên, tính lại vị trí ngay tại đây rồi căn giữa + focus thẻ (không setState trong effect — R3 GĐ4).
  function focusMember(memberId: number) {
    const fid = familyIdOf(data, memberId);
    if (fid === null) return;
    const next = new Set(collapsed);
    for (const a of ancestorFamilyIds(data, fid)) next.delete(a);
    const laid = layoutTree(data, next).families.find((f) => f.id === fid);
    setCollapsed(next);
    setHighlightId(memberId);
    if (laid) void setCenter(laid.x + laid.width / 2, laid.y + laid.height / 2, { zoom: 1, duration: 400 });
    // Node mới dựng lại bị React Flow ẩn (visibility: hidden) tới khi đo xong → thử lại vài khung hình đến khi focus được.
    const tryFocus = (left: number) =>
      requestAnimationFrame(() => {
        const el = wrapRef.current?.querySelector<HTMLElement>(`[data-member-id="${memberId}"]`);
        el?.focus({ preventScroll: true });
        if (document.activeElement !== el && left > 0) tryFocus(left - 1);
      });
    tryFocus(30);
  }

  const nodes = useMemo<(FamilyFlowNode | BandNode)[]>(
    () => [
      ...layout.bands.map<BandNode>((b) => ({
        id: `band-${b.generation}`,
        type: "band",
        position: { x: 0, y: b.y },
        data: { width: layout.width, height: b.height, odd: b.generation % 2 === 1 },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      })),
      ...layout.families.map<FamilyFlowNode>((laid) => ({
        id: `f-${laid.id}`,
        type: "family",
        position: { x: laid.x, y: laid.y },
        data: { family: byId.get(laid.id)!, laid, highlightId, onToggle: toggle },
        draggable: false,
        selectable: false,
        focusable: false,
        // React Flow tắt pointer-events cho node không chọn/kéo được — bật lại để bấm thẻ và nút Thu gọn.
        style: { pointerEvents: "all" },
      })),
    ],
    [layout, byId, highlightId, toggle],
  );
  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => ({
        id: `e-${e.from}-${e.to}`,
        source: `f-${e.from}`,
        target: `f-${e.to}`,
        type: "smoothstep",
        selectable: false,
        focusable: false,
        style: { stroke: "var(--input)", strokeWidth: 1.5 },
      })),
    [layout],
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        maxZoom={1.5}
        onInit={onInit}
      />
      <BandLabels bands={layout.bands} />

      <TreeSearchPanel data={data} highlightId={highlightId} onPick={focusMember} className="absolute top-3 left-3 z-10 w-[min(360px,calc(100%-24px))]" />

      {focusId !== null && focusFamily === null && !missingClosed && (
        <div className="absolute top-[84px] left-3 z-10 flex w-[min(360px,calc(100%-24px))] items-start gap-2 rounded-lg border border-border bg-card p-3 shadow-(--shadow-card)">
          <p role="status" className="flex-1 text-sm">
            Người này không có trên cây gia phả (nhánh ngoại hoặc chưa gắn bố).
          </p>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setMissingClosed(true)}
            className="-m-1 flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}

      {!hintDismissed && (
        <div className="absolute top-[84px] right-3 left-3 z-10 flex items-start gap-3 rounded-lg border border-accent bg-card p-3 text-[15px] shadow-(--shadow-card) sm:top-3 sm:right-auto sm:left-[384px] sm:w-80">
          <p className="flex-1">
            <span className="pointer-coarse:hidden">Kéo để di chuyển, lăn chuột hoặc bấm + − để phóng to/thu nhỏ.</span>
            <span className="hidden pointer-coarse:inline">Chụm hai ngón để phóng to/thu nhỏ, kéo một ngón để di chuyển.</span> Bấm vào thẻ để xem chi tiết.
          </p>
          <Button size="sm" variant="outline" onClick={dismissHint}>
            Đã hiểu
          </Button>
        </div>
      )}

      <aside
        id="tree-legend"
        aria-label="Chú giải"
        className={cn(
          "absolute right-3 bottom-36 z-10 w-64 rounded-lg border border-border bg-card p-3 text-sm shadow-(--shadow-card) lg:top-3 lg:bottom-auto lg:block",
          legendOpen ? "block" : "hidden",
        )}
      >
        <p className="mb-2 font-semibold">Chú giải</p>
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-6 rounded-sm border border-t-4 border-border border-t-primary bg-card" />
            Người trong dòng họ
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-6 rounded-sm border border-t-4 border-border border-t-accent bg-card" />
            Vợ/chồng (ghi “vợ của …”)
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-6 rounded-sm border border-border bg-muted" />
            Đã khuất
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-6 rounded-sm border-2 border-accent bg-card" />
            Đang chọn / kết quả tìm
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Không vẽ con của con gái (nhánh ngoại).</p>
      </aside>

      <div className="absolute right-3 bottom-3 z-20 flex flex-col items-end gap-2">
        <Link href="/tree?view=list" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <List aria-hidden="true" /> Dạng danh sách
        </Link>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={legendOpen}
          aria-controls="tree-legend"
          onClick={() => setLegendOpen((v) => !v)}
          className="lg:hidden"
        >
          Chú giải
        </Button>
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex items-end gap-3">
        <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <button type="button" aria-label="Phóng to" onClick={() => void zoomIn()} className="flex size-10 items-center justify-center hover:bg-muted">
            <Plus aria-hidden="true" className="size-5" />
          </button>
          <button type="button" aria-label="Thu nhỏ" onClick={() => void zoomOut()} className="flex size-10 items-center justify-center border-t border-border hover:bg-muted">
            <Minus aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Vừa màn hình"
            onClick={() => void fitView({ ...FIT_OPTS, duration: 300 })}
            className="flex size-10 items-center justify-center border-t border-border hover:bg-muted"
          >
            <Maximize aria-hidden="true" className="size-5" />
          </button>
          <ZoomLevel />
        </div>
        {myFamily !== null && myMemberId !== null && (
          <Button variant="outline" onClick={() => focusMember(myMemberId)}>
            <UserRound aria-hidden="true" className="size-4" /> Về hồ sơ của tôi
          </Button>
        )}
      </div>
    </div>
  );
}

export function TreeView(props: Props & { isAdmin: boolean }) {
  if (props.data.families.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-(--shadow-card)">
          <Network aria-hidden="true" className="size-10 text-accent" />
          <p className="font-heading text-xl font-semibold">Chưa có ai trên cây gia phả.</p>
          <p className="text-muted-foreground">
            Cây tự dựng khi có thành viên. {props.isAdmin ? "Hãy thêm cụ tổ (đời 1) trước." : "Quản trị viên sẽ nhập dữ liệu gia phả."}
          </p>
          {props.isAdmin ? (
            <Link href="/members/new" className={buttonVariants()}>
              Thêm thành viên
            </Link>
          ) : (
            <Link href="/members" className={buttonVariants({ variant: "outline" })}>
              Xem danh sách thành viên
            </Link>
          )}
        </div>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <TreeCanvas data={props.data} myMemberId={props.myMemberId} focusId={props.focusId} />
    </ReactFlowProvider>
  );
}
