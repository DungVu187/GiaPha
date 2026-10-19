// Lớp CSS chung cho các hộp thoại quản trị (Base UI Backdrop + Popup).
export const DIALOG_BACKDROP = "fixed inset-0 z-50 bg-foreground/40";
export const DIALOG_POPUP =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-card p-6 shadow-(--shadow-card)";
export const DIALOG_TITLE = "font-heading text-xl font-semibold";
