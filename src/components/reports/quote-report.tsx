"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { useTable } from "@/hooks/use-data";
import { quoteStats, REJECT_REASON_LABELS, type ReasonCount } from "@/lib/quote-stats";
import { formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

/**
 * Câte oferte câștigi, și pe ce le pierzi.
 *
 * Cifra care lipsea: știai cât ai făcut, nu și pe lângă cât ai trecut. Iar
 * motivele, strânse, spun ce să schimbi — dacă cinci din șase pierdute au
 * fost pe preț, întrebarea nu mai e „de ce nu vin oamenii”.
 */
export function QuoteReport({ from, to }: { from?: string; to?: string }) {
  const { currency } = useApp();
  const quotes = useTable("quotes");
  const items = useTable("quote_items");

  const stats = useMemo(
    () => quoteStats(quotes, items, { from, to }),
    [quotes, items, from, to],
  );

  if (stats.decided === 0) return null;

  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="size-4 text-primary" /> Oferte
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <Cell
          label="câștigate"
          value={String(stats.accepted)}
          hint={formatMoney(stats.wonValue, currency, { compact: true })}
          tone="text-emerald-300"
        />
        <Cell
          label="pierdute"
          value={String(stats.rejected)}
          hint={formatMoney(stats.lostValue, currency, { compact: true })}
          tone="text-amber-300"
        />
        <Cell
          label="fără răspuns"
          value={String(stats.sent)}
          hint={stats.winRate !== null ? `${stats.winRate}% câștigate` : "—"}
        />
      </div>

      {stats.reasons.length > 0 && (
        <div className="space-y-1.5 rounded-2xl surface p-3.5">
          <p className="text-xs font-medium text-muted-foreground">
            De ce n-au ieșit
          </p>
          <ul className="space-y-1">
            {stats.reasons.map((row) => (
              <ReasonRow key={row.reason ?? "none"} row={row} currency={currency} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ReasonRow({ row, currency }: { row: ReasonCount; currency: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className={row.reason ? "" : "text-muted-foreground"}>
        {row.reason ? REJECT_REASON_LABELS[row.reason] : "Fără motiv scris"}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {row.quotes} · {formatMoney(row.value, currency, { compact: true })}
      </span>
    </li>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl surface p-3">
      <p className={`text-xl font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-[11px] tabular-nums text-muted-foreground">{hint}</p>
    </div>
  );
}
