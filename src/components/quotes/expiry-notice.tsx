"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { extendQuote } from "@/lib/db/actions";
import { quoteExpiry } from "@/lib/expiry";
import { formatDate, todayKey } from "@/lib/format";
import type { Quote } from "@/lib/types";

/**
 * Oferta trecută de termen, spusă pe față.
 *
 * Termenul se scria pe ofertă și se tipărea pe hârtie, dar aplicația nu-l
 * citea. Baza, da: funcția care servește linkul public filtrează după el,
 * deci clientul deschide și nu vede nimic — iar tu îi dai ghes degeaba.
 *
 * Prelungirea numără de azi, nu din termenul vechi, și face linkul bun din
 * nou în aceeași clipă: e aceeași coloană pe care o citește baza.
 */
export function ExpiryNotice({ quote }: { quote: Quote }) {
  const [busy, setBusy] = useState(false);
  const expiry = quoteExpiry(quote, todayKey());

  if (!expiry || (!expiry.expired && !expiry.soon)) return null;

  const extend = async (days: number) => {
    setBusy(true);
    try {
      const until = await extendQuote(quote.id, days);
      toast.success(`Valabilă până la ${formatDate(until)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        expiry.expired
          ? "no-print space-y-2.5 rounded-xl border border-zinc-500/40 bg-zinc-500/10 p-3.5"
          : "no-print space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5"
      }
    >
      <p
        className={`flex items-start gap-2 text-sm ${
          expiry.expired ? "text-zinc-200" : "text-amber-200"
        }`}
      >
        <CalendarX className="mt-0.5 size-4 shrink-0" />
        <span>
          {expiry.expired ? (
            <>
              Termenul a trecut pe {formatDate(quote.valid_until!)}. Clientul
              deschide linkul și nu mai vede nimic — prelungește-l dacă oferta
              e încă bună.
            </>
          ) : (
            <>
              Valabilă până pe {formatDate(quote.valid_until!)}
              {expiry.days === 0 ? " — adică azi." : `, adică încă ${expiry.days} ${expiry.days === 1 ? "zi" : "zile"}.`}
            </>
          )}
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy} onClick={() => void extend(14)}>
          Încă 14 zile
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void extend(30)}
        >
          Încă o lună
        </Button>
      </div>
    </div>
  );
}
