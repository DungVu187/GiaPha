import { Check } from "lucide-react";

// Thông báo thành công dùng chung (role="status").
export function SuccessNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-md border border-green-700 bg-green-50 px-4 py-3 font-medium text-green-900">
      <Check aria-hidden="true" className="size-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
