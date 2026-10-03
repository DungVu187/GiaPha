import { cn } from "@/lib/utils";

/** Ấn triện họ Vũ (logo): nền đỏ son, viền vàng. Trang trí — luôn đi kèm chữ "GIA PHẢ HỌ VŨ". */
export function BrandSeal({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-sm border-2 border-accent bg-primary font-heading text-xl font-semibold text-primary-foreground",
        className,
      )}
    >
      Vũ
    </span>
  );
}
