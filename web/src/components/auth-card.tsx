import { BrandSeal } from "@/components/brand-seal";
import { Card } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer }: { title?: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-20">
      <Card className="w-full max-w-[480px] gap-5 rounded-lg border border-border px-6 py-8 text-base shadow-[var(--shadow-card)] ring-0 sm:gap-6 sm:p-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandSeal className="size-14 sm:size-16" />
          <p className="font-heading text-2xl leading-8 font-bold text-primary sm:text-[32px] sm:leading-10">GIA PHẢ HỌ VŨ</p>
          {title && <h1 className="font-heading text-xl font-semibold sm:text-2xl">{title}</h1>}
          {description && <div className="text-muted-foreground">{description}</div>}
          <div aria-hidden="true" className="hidden h-0.5 w-16 bg-accent sm:block" />
        </div>
        {children}
        {footer && <div className="flex flex-col items-center gap-4 border-t border-border pt-5 text-muted-foreground">{footer}</div>}
      </Card>
    </main>
  );
}
