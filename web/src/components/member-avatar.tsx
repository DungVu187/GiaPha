import { cn } from "@/lib/utils";
import { initialOf } from "@/lib/format";

export function MemberAvatar({
  fullName,
  avatarPath,
  size,
  alt = fullName,
}: {
  fullName: string;
  avatarPath: string | null;
  size: "sm" | "lg";
  /** Mặc định = họ tên; truyền "" khi tên đã hiển thị cạnh ảnh (tránh đọc 2 lần). */
  alt?: string;
}) {
  const box = size === "lg" ? "size-28 text-4xl" : "size-10 text-lg";
  if (avatarPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh do API phục vụ qua /uploads, không cần tối ưu của next/image
      <img
        src={avatarPath}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-full object-cover", box)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-accent-text", box)}
    >
      {initialOf(fullName)}
    </span>
  );
}
