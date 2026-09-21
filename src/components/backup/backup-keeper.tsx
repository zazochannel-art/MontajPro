"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/app-provider";
import { takeSnapshot } from "@/lib/backup";

/** Cât de des verificăm dacă e vremea unei copii noi. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Copia locală, luată singură.
 *
 * `takeSnapshot` decide dacă e cazul (o copie pe zi, doar dacă există date),
 * așa că aici e destul să-l întrebăm din când în când. Nu randează nimic și nu
 * deranjează pe nimeni: e plasa de siguranță pentru un import greșit sau o
 * ștergere în masă.
 */
export function BackupKeeper() {
  const { ready } = useApp();

  useEffect(() => {
    if (!ready) return;
    const run = () => void takeSnapshot().catch(() => null);
    run();
    const timer = window.setInterval(run, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready]);

  return null;
}
