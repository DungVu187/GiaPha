"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-20">
      <Card className="w-full max-w-[480px] items-center gap-5 rounded-lg px-6 py-8 text-center text-base ring-0 border border-border shadow-[var(--shadow-card)] sm:p-10">
        <h1 className="font-heading text-2xl leading-8 font-bold text-primary">Đã có lỗi xảy ra</h1>
        <p className="text-muted-foreground">Không tải được dữ liệu. Vui lòng thử lại sau.</p>
        <Button type="button" onClick={() => retry()}>
          Thử lại
        </Button>
      </Card>
    </main>
  );
}
