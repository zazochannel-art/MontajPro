"use client";

import { CalendarRange, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAllJobs, useDayBlocks, useWeekLoad } from "@/hooks/use-data";
import { jobsBlockedBy } from "@/lib/day-guard";
import { toggleDayBlock } from "@/lib/db/actions";
import { formatDuration } from "@/lib/format";

const SHORT = ["L", "Ma", "Mi", "J", "V", "S", "D"];

/**
 * Cât ai liber săptămâna asta.
 *
 * Clientul întreabă „când puteți veni?”, iar răspunsul se dădea derulând
 * calendarul. Acum, că orele estimate se calculează singure din ritmul tău,
 * adunarea are pe ce sta.
 *
 * Apăsarea lungă pe o zi o blochează: o nuntă, o sărbătoare, o zi la spital.
 */
export function WeekCapacity({ from }: { from?: Date }) {
  const week = useWeekLoad(from ?? new Date());
  const jobs = useAllJobs();
  const blocks = useDayBlocks();
  const today = new Date().toISOString().slice(0, 10);

  const tone =
    week.free < 0
      ? "text-red-300"
      : week.free < week.available * 0.25
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <section className="surface space-y-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="size-4 text-primary" /> Săptămâna asta
          </h3>
          <p className="text-xs text-muted-foreground">
            {week.hours > 0
              ? `${formatDuration(week.hours * 60)} programate din ${week.available} ore.`
              : "Nimic programat încă."}
          </p>
        </div>
        <p className={`shrink-0 text-sm font-semibold tabular-nums ${tone}`}>
          {week.free >= 0
            ? `${formatDuration(week.free * 60)} liber`
            : `${formatDuration(Math.abs(week.free) * 60)} peste`}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {week.days.map((day, index) => {
          const isToday = day.day === today;
          const full = day.hours >= 8;
          return (
            <button
              key={day.day}
              type="button"
              onClick={async () => {
                const block = blocks.find((row) => row.day === day.day);
                /*
                 * Blocai ziua și cele două lucrări programate acolo rămâneau
                 * acolo, tăcute. Blocarea nu le mută — mutarea e o hotărâre,
                 * nu o consecință — dar nu mai trece nespusă.
                 */
                const caught = block ? [] : jobsBlockedBy(day.day, jobs);
                await toggleDayBlock(day.day);
                if (block) return toast.success("Zi eliberată");
                if (caught.length) {
                  toast.warning(
                    caught.length === 1
                      ? `Zi blocată, dar „${caught[0].title}” rămâne programată atunci`
                      : `Zi blocată, dar ${caught.length} lucrări rămân programate atunci`,
                    {
                      description: "Mută-le din calendar dacă nu se mai țin.",
                    },
                  );
                } else {
                  toast.success("Zi blocată");
                }
              }}
              title={
                day.blocked
                  ? day.blockReason || "Zi blocată — apasă ca s-o eliberezi"
                  : "Apasă ca să blochezi ziua"
              }
              aria-pressed={day.blocked}
              aria-label={
                day.blocked
                  ? `Eliberează ziua de ${day.day}`
                  : `Blochează ziua de ${day.day}`
              }
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${
                day.blocked
                  ? "border-zinc-600/50 bg-zinc-600/15 text-muted-foreground"
                  : full
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : day.hours > 0
                      ? "border-primary/30 bg-primary/10 text-primary-soft"
                      : "border-border bg-elevated text-muted-foreground"
              } ${isToday ? "ring-1 ring-primary/50" : ""}`}
            >
              <span className="text-[10px] font-medium uppercase">
                {SHORT[index]}
              </span>
              {day.blocked ? (
                <Lock className="size-3" />
              ) : (
                <span className="text-xs font-semibold tabular-nums">
                  {day.hours > 0 ? day.hours : "—"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {week.freeDays.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Zile libere: {week.freeDays.length}. Apasă o zi ca s-o blochezi.
        </p>
      )}
    </section>
  );
}
