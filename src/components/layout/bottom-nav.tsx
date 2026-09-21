"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { isActivePath, visibleBottomNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-provider";
import { useT } from "@/hooks/use-t";

/**
 * Navigația de jos + butonul flotant „+”, montate într-o singură bară ca să nu
 * acopere conținutul. Apare doar pe mobil și tabletă.
 */
export function BottomNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { siteMode } = useApp();
  const t = useT();
  const items = visibleBottomNav(siteMode);
  const [left, right] = [items.slice(0, 2), items.slice(2)];

  const renderItem = (item: NavItem) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5",
          "transition-colors duration-[--dur-1] ease-[--ease-out] active:scale-95",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {/*
         * Lumina de deasupra iconiței. E singurul semn de „ești aici” care se
         * vede și cu telefonul în soare, unde diferența de culoare dispare.
         */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-px h-px rounded-full bg-primary transition-all duration-[--dur-2] ease-[--ease-spring]",
            active
              ? "w-10 opacity-100 shadow-[0_0_14px_2px_var(--primary)]"
              : "w-0 opacity-0",
          )}
        />
        <item.icon
          className={cn(
            "size-[22px] transition-transform duration-[--dur-2] ease-[--ease-spring]",
            active && "-translate-y-0.5 drop-shadow-[0_0_10px_var(--primary)]",
          )}
        />
        <span className="text-[11px] font-medium">{t(item.label)}</span>
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch gap-1 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
        {left.map(renderItem)}

        <div className="flex w-16 shrink-0 items-start justify-center">
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label={t("Adaugă")}
            className={cn(
              "relative -mt-6 flex size-14 items-center justify-center rounded-2xl",
              "bg-[linear-gradient(145deg,var(--primary-soft),var(--primary)_55%,#b4783f)] text-primary-foreground",
              "shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent),0_2px_6px_rgba(0,0,0,0.5)]",
              "ring-1 ring-inset ring-white/25",
              "transition-transform duration-[--dur-1] ease-[--ease-spring] active:scale-90",
            )}
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>

        {right.map(renderItem)}
      </div>
    </nav>
  );
}
