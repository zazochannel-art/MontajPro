"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, HardHat, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { isActivePath, visibleSections } from "@/lib/nav";
import { useApp } from "@/lib/app-provider";
import { useTable } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Logo } from "./logo";
import { SyncBadge } from "./sync-badge";
import { GlobalSearch } from "./global-search";

/** Antetul mobil: înapoi / titlu / notificări + meniu complet. */
export function AppHeader({ title }: { title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { siteMode, setSiteMode } = useApp();

  // Ctrl/Cmd+K, tiparul cu care toată lumea e obișnuită pe desktop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const notifications = useTable("notifications");
  const unread = notifications.filter((item) => !item.read_at).length;

  const isRoot = pathname === "/";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:h-16 lg:px-8">
          {isRoot ? (
            <div className="lg:hidden">
              <Logo />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Înapoi"
              className="-ml-1 flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}

          {title && (
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold lg:text-lg">
              {title}
            </h1>
          )}
          {!title && <div className="flex-1" />}

          {siteMode && (
            <button
              type="button"
              onClick={() => setSiteMode(false)}
              className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"
            >
              <HardHat className="size-3.5" /> Șantier
            </button>
          )}

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Caută"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="size-5" />
          </button>

          <SyncBadge />

          <Link
            href="/notificari"
            aria-label="Notificări"
            className="relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Meniu"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Meniu</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {visibleSections(siteMode).map((section) => (
              <div key={section.title}>
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-accent",
                        )}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
