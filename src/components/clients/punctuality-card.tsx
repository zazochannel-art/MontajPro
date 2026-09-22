"use client";

import { useMemo } from "react";
import { CalendarClock, CircleAlert, ThumbsUp } from "lucide-react";
import { useTable } from "@/hooks/use-data";
import { punctuality } from "@/lib/punctuality";
import { formatMoney, todayKey } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import type { Job } from "@/lib/types";

/**
 * Cum plătește omul ăsta.
 *
 * Scadențarul știa de la început când trebuie să vină banii, plățile știu când
 * au venit; nimeni nu le punea una lângă alta. Iar „ăsta plătește greu” ca
 * impresie nu te ajută când negociezi avansul — o cifră, da.
 *
 * Nu apare deloc cât timp n-are nimic de spus: un client fără scadențar ar
 * primi altfel un card gol, care arată ca o acuzație nefondată.
 */
export function PunctualityCard({ jobs }: { jobs: Job[] }) {
  const { currency } = useApp();
  const installments = useTable("installments");
  const payments = useTable("payments");

  const stats = useMemo(() => {
    const ids = new Set(jobs.map((job) => job.id));
    return punctuality(installments, payments, ids, todayKey());
  }, [installments, payments, jobs]);

  const settled = stats.onTime + stats.late;
  if (settled === 0 && stats.overdue === 0) return null;

  const tone =
    stats.verdict === "greu"
      ? "text-amber-300"
      : stats.verdict === "bun"
        ? "text-emerald-300"
        : "text-muted-foreground";

  return (
    <section className="space-y-2.5 rounded-2xl surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-primary" /> Cum plătește
        </h3>
        {stats.verdict !== "necunoscut" && (
          <span className={`flex items-center gap-1 text-xs font-medium ${tone}`}>
            {stats.verdict === "bun" && <ThumbsUp className="size-3.5" />}
            {stats.verdict === "bun"
              ? "la timp"
              : stats.verdict === "mediu"
                ? "cu întârzieri"
                : "greu"}
          </span>
        )}
      </div>

      {settled > 0 && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Figure label="la timp" value={String(stats.onTime)} />
          <Figure label="cu întârziere" value={String(stats.late)} />
          <Figure
            label="întârziere medie"
            value={stats.late > 0 ? `${stats.averageDelay} zile` : "—"}
          />
        </div>
      )}

      {stats.late > 0 && (
        <p className="text-xs text-muted-foreground">
          Cel mai mult a întârziat {stats.worstDelay} zile.
        </p>
      )}

      {stats.overdue > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {stats.overdue}{" "}
            {stats.overdue === 1 ? "tranșă scadentă" : "tranșe scadente"} și
            neplătite — {formatMoney(stats.overdueAmount, currency)}.
          </span>
        </p>
      )}

      {settled > 0 && settled < 3 && (
        <p className="text-xs text-muted-foreground">
          Prea puține tranșe ca să însemne ceva. Din trei în sus începe să se
          vadă un tipar.
        </p>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-2.5">
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
