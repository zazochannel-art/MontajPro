"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, HardHat, Menu, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  /*
   * Antetul se „ridică” după ce pagina a fost derulată: capătă fundal opac și
   * o umbră, ca să se desprindă de conținutul care trece pe dedesubt. Clasa se
   * pune direct pe element, nu prin stare: la derulare s-ar re-randa antetul
   * de zeci de ori pe secundă degeaba.
   */
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const el = headerRef.current;
      if (el) el.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const notifications = useTable("notifications");
  const unread = notifications.filter((item) => !item.read_at).length;

  const isRoot = pathname === "/";

  return (
    <>
      {/*
       * `pt-[env(safe-area-inset-top)]` este motivul pentru care antetul se
       * vede pe telefon. Aplicația instalată desenează pagina până sub bara
       * de stare (ceas, semnal, baterie); fără marginea asta, logoul și
       * butoanele ajung dedesubtul ei. Fundalul antetului urcă în spatele
       * barei, conținutul rămâne sub ea. În browser marginea e 0.
       */}
      <header
        ref={headerRef}
        data-scrolled="false"
        className="sticky top-0 z-30 border-b border-transparent bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-[--dur-2] ease-[--ease-out] data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/92 data-[scrolled=true]:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.9)]"
      >
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
              className="-ml-1 flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,transform] duration-[--dur-1] ease-[--ease-out] hover:bg-accent hover:text-foreground active:scale-90 lg:hidden"
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
              className="pop flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-300 transition-transform duration-[--dur-1] active:scale-95"
            >
              <HardHat className="size-3.5" /> Șantier
            </button>
          )}

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Caută"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,transform] duration-[--dur-1] ease-[--ease-out] hover:bg-accent hover:text-foreground active:scale-90"
          >
            <Search className="size-5" />
          </button>

          <SyncBadge />

          <Link
            href="/notificari"
            aria-label="Notificări"
            className="relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,transform] duration-[--dur-1] ease-[--ease-out] hover:bg-accent hover:text-foreground active:scale-90"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="pop absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Meniu"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,transform] duration-[--dur-1] ease-[--ease-out] hover:bg-accent hover:text-foreground active:scale-90 lg:hidden"
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
