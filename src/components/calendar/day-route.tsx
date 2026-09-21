"use client";

import { AlertTriangle, Clock, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayLoad, routeHref } from "@/lib/route";
import { formatDuration } from "@/lib/format";
import type { Job } from "@/lib/types";

/**
 * Ziua, ca drum și ca încărcare.
 *
 * Două lucruri pe care calendarul nu le spunea: în ce ordine mergi și dacă
 * ziua e promisă de două ori. Apare doar când are ce spune — o zi cu o
 * singură lucrare n-are nevoie de o rută.
 */
export function DayRoute({ jobs, className }: { jobs: Job[]; className?: string }) {
  const load = dayLoad(jobs);
  const href = routeHref(load.stops.map((stop) => stop.address));
  const hasRoute = load.stops.length > 1;
  const hasWarning = load.long || load.overlaps.length > 0;

  if (!hasRoute && !hasWarning) return null;

  return (
    <section
      className={className ?? "space-y-3 rounded-2xl border border-border bg-card p-4"}
    >
      {hasWarning && (
        <div className="space-y-1.5">
          {load.overlaps.length > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {load.overlaps.length === 1
                  ? `„${load.overlaps[0].a.title}" și „${load.overlaps[0].b.title}" sunt la aceeași oră.`
                  : `${load.overlaps.length} lucrări se suprapun la oră.`}
              </span>
            </p>
          )}
          {load.long && (
            <p className="flex items-start gap-2 text-sm text-amber-300">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>
                {formatDuration(Math.round(load.hours * 60))} promise într-o
                singură zi.
              </span>
            </p>
          )}
        </div>
      )}

      {hasRoute && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Navigation className="size-4 text-primary" /> Ruta zilei
            </h3>
            {href && (
              <Button asChild size="sm" variant="outline">
                <a href={href} target="_blank" rel="noopener noreferrer">
                  Deschide în hartă
                </a>
              </Button>
            )}
          </div>

          <ol className="space-y-1.5">
            {load.stops.map((stop, index) => (
              <li key={stop.job.id} className="flex items-start gap-2 text-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-medium tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {stop.job.scheduled_time ? `${stop.job.scheduled_time} · ` : ""}
                    {stop.job.title}
                  </span>
                  <span className="flex items-center gap-1 truncate text-muted-foreground">
                    <MapPin className="size-3 shrink-0" /> {stop.address}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
