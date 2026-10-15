import { CalendarDays, House, Network, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon; match: (pathname: string) => boolean };

// Khớp đúng trang hoặc trang con ("/tree", "/tree/…"), không khớp "/treeX".
const under = (base: string) => (p: string) => p === base || p.startsWith(`${base}/`);

// "Quản trị", "Tài khoản của tôi" thêm ở GĐ6 khi có trang (P4).
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", short: "Trang chủ", icon: House, match: (p) => p === "/" },
  { href: "/tree", label: "Cây gia phả", short: "Cây", icon: Network, match: under("/tree") },
  { href: "/members", label: "Thành viên", short: "Thành viên", icon: Users, match: under("/members") },
  { href: "/anniversaries", label: "Lịch giỗ", short: "Lịch giỗ", icon: CalendarDays, match: under("/anniversaries") },
];
