"use client";

import "@xyflow/react/dist/style.css";
import { ReactFlow, ReactFlowProvider, useReactFlow, useViewport, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Maximize, Minus, Plus, Search, UserRound } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ancestorFamilyIds, familyIdOf, layoutTree, searchTree } from "@/lib/tree-layout";
import type { TreeData } from "@/lib/tree-types";
import { FamilyNode, type FamilyFlowNode } from "./family-node";

type BandNode = Node<{ generation: number; width: number; height: number }, "band">;

function Band({ data }: NodeProps<BandNode>) {
  return (
    <div
      data-band={data.generation}
      className={cn("flex items-start border-t border-border/60 pt-3 pl-4", data.generation % 2 === 1 && "bg-secondary/40")}
      style={{ width: data.width, height: data.height }}
    >
      <span className="font-heading text-muted-foreground">
        Đời <span className="block text-3xl leading-none text-foreground">{data.generation}</span>
      </span>
    </div>
  );
}

const nodeTypes = { family: FamilyNode, band: Band };
const FIT_ALL = { padding: 0.1 };

type Props = { data: TreeData; myMemberId: number | null; focusId: number | null };

function TreeCanvas({ data, myMemberId, focusId }: Props) {
  const { setCenter, zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  // Focus từ URL: mặc định mọi nhánh mở sẵn nên chỉ cần tô sáng + để React Flow căn vào khối đó lúc đầu.
  const focusFamily = focusId !== null ? familyIdOf(data, focusId) : null;
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [highlightId, setHighlightId] = useState<number | null>(focusFamily !== null ? focusId : null);
  const [initialFit] = useState(() =>
    focusFamily !== null ? { nodes: [{ id: `f-${focusFamily}` }], maxZoom: 1 } : FIT_ALL,
  );
  const [query, setQuery] = useState("");
  // Thu danh sách sau khi chọn để bảng tìm không che thẻ vừa căn giữa (điện thoại); sửa ô / focus → mở lại.
  const [resultsOpen, setResultsOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);

  const layout = useMemo(() => layoutTree(data, collapsed), [data, collapsed]);
  const byId = useMemo(() => new Map(data.families.map((f) => [f.id, f])), [data]);
  const hits = useMemo(() => searchTree(data, query), [data, query]);

  const toggle = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Mở nhánh tổ tiên, tính lại vị trí ngay tại đây rồi căn giữa (không setState trong effect).
  function focusMember(memberId: number) {
    const fid = familyIdOf(data, memberId);
    if (fid === null) return;
    const next = new Set(collapsed);
    for (const a of ancestorFamilyIds(data, fid)) next.delete(a);
    const laid = layoutTree(data, next).families.find((f) => f.id === fid);
    setCollapsed(next);
    setHighlightId(memberId);
    if (laid) void setCenter(laid.x + laid.width / 2, laid.y + laid.height / 2, { zoom: 1, duration: 400 });
  }

  const nodes = useMemo<(FamilyFlowNode | BandNode)[]>(
    () => [
      ...layout.bands.map<BandNode>((b) => ({
        id: `band-${b.generation}`,
        type: "band",
        position: { x: 0, y: b.y },
        data: { generation: b.generation, width: layout.width, height: b.height },
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
  const canFocusMe = myMemberId !== null && familyIdOf(data, myMemberId) !== null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        maxZoom={1.5}
        fitView
        fitViewOptions={initialFit}
      />

      <section
        aria-label="Bảng tìm người"
        className="absolute top-3 left-3 z-10 w-[min(320px,calc(100%-24px))] rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]"
      >
        <Label htmlFor="tree-search" className="mb-2 block font-semibold">
          Tìm người trên cây
        </Label>
        <div className="relative">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="tree-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResultsOpen(true);
            }}
            onFocus={() => setResultsOpen(true)}
            placeholder="Nhập tên, gõ không dấu được"
            className="pl-9"
          />
        </div>
        {resultsOpen && query.trim() !== "" && (
          <>
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {hits.length > 0 ? `${hits.length} kết quả (tìm không dấu)` : "Không tìm thấy trên cây."}
            </p>
            {hits.length > 0 && (
              <ul data-testid="tree-search-results" className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.memberId}>
                    <button
                      type="button"
                      onClick={() => {
                        setResultsOpen(false);
                        focusMember(h.memberId);
                      }}
                      aria-current={highlightId === h.memberId}
                      className="w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:bg-muted aria-[current=true]:border-accent aria-[current=true]:bg-accent/15"
                    >
                      <span className="block font-semibold">{h.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        Đời {h.generation} — {h.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {focusId !== null && focusFamily === null && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Người này không có trên cây gia phả (nhánh ngoại).
          </p>
        )}
      </section>

      <button
        type="button"
        aria-expanded={legendOpen}
        aria-controls="tree-legend"
        onClick={() => setLegendOpen((v) => !v)}
        className="absolute right-3 bottom-8 z-20 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm lg:hidden"
      >
        Chú giải
      </button>
      <aside
        id="tree-legend"
        aria-label="Chú giải"
        className={cn(
          "absolute right-3 bottom-20 z-10 w-64 rounded-lg border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)] lg:top-3 lg:bottom-auto lg:block",
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
            Vợ/chồng ngoài họ
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-6 rounded-sm border border-border bg-muted" />
            Đã khuất
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-6 rounded-sm border-2 border-accent bg-card" />
            Kết quả tìm kiếm
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Không vẽ con của con gái (nhánh ngoại).</p>
      </aside>

      <div className="absolute bottom-3 left-3 z-10 flex items-end gap-3">
        <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <button type="button" aria-label="Phóng to" onClick={() => void zoomIn()} className="p-2 hover:bg-muted">
            <Plus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Thu nhỏ"
            onClick={() => void zoomOut()}
            className="border-t border-border p-2 hover:bg-muted"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Vừa màn hình"
            onClick={() => void fitView({ ...FIT_ALL, duration: 300 })}
            className="border-t border-border p-2 hover:bg-muted"
          >
            <Maximize aria-hidden="true" className="size-4" />
          </button>
          <span data-testid="zoom-level" className="border-t border-border px-1 py-1 text-center text-xs">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        {canFocusMe && (
          <Button variant="outline" onClick={() => focusMember(myMemberId)}>
            <UserRound aria-hidden="true" className="size-4" /> Về hồ sơ của tôi
          </Button>
        )}
        <p className="hidden pb-2 text-sm text-muted-foreground md:block">
          Kéo để di chuyển, cuộn để phóng to/thu nhỏ. Bấm vào thẻ để xem chi tiết.
        </p>
      </div>
    </div>
  );
}

export function TreeView(props: Props) {
  if (props.data.families.length === 0) {
    return <p className="p-10 text-center text-muted-foreground">Chưa có ai trên cây gia phả.</p>;
  }
  return (
    <ReactFlowProvider>
      <TreeCanvas {...props} />
    </ReactFlowProvider>
  );
}
