import { CalendarDays, House, Network, ShieldCheck, UserRound, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon; match: (pathname: string) => boolean };

// Khớp đúng trang hoặc trang con ("/tree", "/tree/…"), không khớp "/treeX".
const under = (base: string) => (p: string) => p === base || p.startsWith(`${base}/`);

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", short: "Trang chủ", icon: House, match: (p) => p === "/" },
  { href: "/tree", label: "Cây gia phả", short: "Cây", icon: Network, match: under("/tree") },
  { href: "/members", label: "Thành viên", short: "Thành viên", icon: Users, match: under("/members") },
  { href: "/anniversaries", label: "Lịch giỗ", short: "Lịch giỗ", icon: CalendarDays, match: under("/anniversaries") },
];

export const ADMIN_NAV_ITEM: NavItem = { href: "/admin", label: "Quản trị", short: "Quản trị", icon: ShieldCheck, match: under("/admin") };
export const ACCOUNT_LINK: NavItem = { href: "/account", label: "Tài khoản của tôi", short: "Tài khoản", icon: UserRound, match: under("/account") };
