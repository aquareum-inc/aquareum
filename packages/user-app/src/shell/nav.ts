import {
  Clapperboard,
  FolderOpen,
  MessageCircle,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar. */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Chat", icon: MessageCircle, primary: true },
  { href: "/studio", label: "Studio", icon: Clapperboard, primary: true },
  { href: "/characters", label: "Characters", icon: Users, primary: true },
  { href: "/library", label: "Library", icon: FolderOpen, primary: true },
  { href: "/developers", label: "Developers", icon: Terminal, primary: false },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" || pathname.startsWith("/chat") : pathname.startsWith(href);
}
