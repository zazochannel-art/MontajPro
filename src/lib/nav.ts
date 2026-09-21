import {
  BarChart3,
  Building2,
  Calculator,
  FileCheck,
  HardHat,
  CalendarDays,
  FileText,
  Hammer,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  ReceiptText,
  Bell,
  Ruler,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Cheie pentru numărătoare (ex. notificări necitite). */
  badge?: "notifications" | "active_jobs";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/lucrari",
        label: "Lucrări",
        icon: Hammer,
        badge: "active_jobs",
      },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/clienti", label: "Clienți", icon: Users },
      { href: "/proiecte", label: "Proiecte", icon: Building2 },
    ],
  },
  {
    title: "Pe teren",
    items: [
      { href: "/masuratori", label: "Măsurători", icon: Ruler },
      { href: "/calculator", label: "Calculator preț", icon: Calculator },
      { href: "/oferte", label: "Oferte", icon: FileText },
    ],
  },
  {
    title: "Resurse",
    items: [
      { href: "/finante", label: "Finanțe", icon: Wallet },
      { href: "/rapoarte", label: "Rapoarte", icon: BarChart3 },
      { href: "/facturi", label: "Facturi", icon: ReceiptText },
      { href: "/predari", label: "Procese-verbale", icon: FileCheck },
      { href: "/garantii", label: "Garanții", icon: ShieldCheck },
      { href: "/materiale", label: "Materiale", icon: Package },
      { href: "/scule", label: "Scule", icon: Wrench },
      { href: "/portofoliu", label: "Portofoliu", icon: ImageIcon },
    ],
  },
  {
    title: "Cont",
    items: [
      { href: "/echipa", label: "Echipă", icon: HardHat },
      {
        href: "/notificari",
        label: "Notificări",
        icon: Bell,
        badge: "notifications",
      },
      { href: "/cos", label: "Coș", icon: Trash2 },
      { href: "/setari", label: "Setări", icon: Settings },
    ],
  },
];

/** Cele 4 destinații din bara de jos (a 5-a poziție este butonul „+”). */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/", label: "Acasă", icon: LayoutDashboard },
  { href: "/lucrari", label: "Lucrări", icon: Hammer },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/finante", label: "Bani", icon: Wallet },
];

/**
 * Paginile care arată bani și care dispar în modul șantier.
 *
 * Nu e o chestiune de secrete, ci de bun-simț: lângă client, pe un telefon
 * ținut în mână, profitul pe luna trecută n-are ce căuta la vedere.
 */
const MONEY_PAGES = new Set(["/finante", "/rapoarte", "/facturi"]);

export function visibleSections(siteMode: boolean): NavSection[] {
  if (!siteMode) return NAV_SECTIONS;
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !MONEY_PAGES.has(item.href)),
  })).filter((section) => section.items.length > 0);
}

/** Pe șantier, locul „Banilor" din bara de jos îl ia măsurătoarea. */
export function visibleBottomNav(siteMode: boolean): NavItem[] {
  if (!siteMode) return BOTTOM_NAV;
  return BOTTOM_NAV.map((item) =>
    MONEY_PAGES.has(item.href)
      ? { href: "/masuratori", label: "Măsuri", icon: Ruler }
      : item,
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
