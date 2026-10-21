import {
  LayoutDashboard,
  Boxes,
  Scale,
  ArrowLeftRight,
  FlaskConical,
  Gift,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** 좌측 메뉴 — 실제 앱 메뉴 구조(더미 단계). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/assets", label: "자산", icon: Boxes },
  { href: "/reconcile", label: "자산 대사", icon: Scale },
  { href: "/loans", label: "대여", icon: ArrowLeftRight },
  { href: "/consumables", label: "소모품", icon: FlaskConical },
  { href: "/promo", label: "홍보물품", icon: Gift },
  { href: "/settings", label: "설정", icon: Settings },
];

/** 현재 경로가 메뉴 항목에 해당하는지 (루트는 정확 일치). */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
