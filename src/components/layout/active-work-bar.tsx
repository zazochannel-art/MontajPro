"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { useActiveSession, useTable } from "@/hooks/use-data";
import { stopWork } from "@/lib/db/actions";
import { formatDuration, formatStopwatch } from "@/lib/format";

/**
 * Bara cronometrului activ. Rămâne vizibilă în toată aplicația, ca să nu uiți
 * niciodată o lucrare pornită.
 */
export function ActiveWorkBar() {
  const session = useActiveSession();
  const jobs = useTable("jobs");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session) return;
    const started = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Date.now() - started);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  if (!session) return null;
  const job = jobs.find((row) => row.id === session.job_id);
  // Peste zece ore nu mai e o sesiune de lucru, e un cronometru uitat.
  const forgotten = elapsed > 10 * 3_600_000;

  return (
    <div className="sticky top-14 z-20 lg:top-16">
      <div
        className={`mx-3 mt-3 flex items-center gap-3 rounded-2xl border p-3 sm:mx-4 lg:mx-8 ${
          forgotten
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-emerald-500/30 bg-emerald-500/10"
        }`}
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            forgotten
              ? "bg-amber-500/20 text-amber-300"
              : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          <Timer className="size-5 animate-pulse" />
        </span>
        <Link href={`/lucrari/${session.job_id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {job?.title ?? "Lucrare"}
          </p>
          <p
            className={`font-mono text-lg font-bold tabular-nums ${
              forgotten ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {formatStopwatch(elapsed)}
          </p>
          {forgotten && (
            <p className="text-xs text-amber-200/80">
              Merge de peste 10 ore — l-ai uitat pornit?
            </p>
          )}
        </Link>
        <button
          type="button"
          onClick={async () => {
            const stopped = await stopWork(session.id);
            toast.success(
              stopped
                ? `Ai lucrat ${formatDuration(stopped.duration_minutes)}`
                : "Cronometru oprit",
            );
          }}
          className={`flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-transform active:scale-95 ${
            forgotten
              ? "bg-amber-500 text-amber-950"
              : "bg-emerald-500 text-emerald-950"
          }`}
        >
          <Square className="size-4 fill-current" />
          Stop
        </button>
      </div>
    </div>
  );
}
