/**
 * Cine plătește la timp și cine te ține.
 *
 * Scadențarul știa de la început când trebuie să vină banii, iar plățile știu
 * când au venit. Nimeni nu punea cele două una lângă alta, așa că „ăsta plătește
 * greu” rămânea o impresie — și impresia nu te ajută când negociezi avansul.
 *
 * Se numără doar tranșele care au și scadență, și plată: una fără scadență
 * n-a întârziat niciodată, iar una neplătită încă nu s-a terminat. Restanțele
 * se numără separat, fiindcă spun altceva: nu cât de greu plătește, ci cât îți
 * datorează acum.
 */
import { num } from "./utils";
import type { Installment, Payment } from "./types";

export interface Punctuality {
  /** Tranșe plătite până în ziua scadenței. */
  onTime: number;
  /** Tranșe plătite după scadență. */
  late: number;
  /** Media întârzierii, în zile, doar peste tranșele întârziate. */
  averageDelay: number;
  /** Cea mai mare întârziere, în zile. */
  worstDelay: number;
  /** Tranșe scadente și neplătite azi. */
  overdue: number;
  /** Cât fac la un loc tranșele scadente și neplătite. */
  overdueAmount: number;
  verdict: "bun" | "mediu" | "greu" | "necunoscut";
}

const DAY = 24 * 60 * 60 * 1000;

/** Zile întregi între două date ISO; negativ dacă a doua e mai devreme. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY);
}

/**
 * Istoricul de plată al unui client.
 *
 * `jobIds` sunt lucrările lui — tranșele se leagă de lucrare, nu de client.
 * `today` se poate da din afară, ca testele să nu depindă de ziua în care rulează.
 */
export function punctuality(
  installments: Installment[],
  payments: Payment[],
  jobIds: Set<string>,
  today: string,
): Punctuality {
  const paidAt = new Map<string, string>();
  for (const payment of payments) {
    if (payment.deleted_at) continue;
    paidAt.set(payment.id, payment.paid_at);
  }

  let onTime = 0;
  let late = 0;
  let overdue = 0;
  let overdueAmount = 0;
  let totalDelay = 0;
  let worstDelay = 0;

  for (const row of installments) {
    if (row.deleted_at || !jobIds.has(row.job_id) || !row.due_date) continue;

    const paid = row.payment_id ? paidAt.get(row.payment_id) : undefined;
    if (!paid) {
      // Neplătită: restanță doar dacă scadența a trecut.
      const late_ = daysBetween(row.due_date, today);
      if (late_ !== null && late_ > 0) {
        overdue += 1;
        overdueAmount += num(row.amount);
      }
      continue;
    }

    const delay = daysBetween(row.due_date, paid);
    if (delay === null) continue;
    if (delay > 0) {
      late += 1;
      totalDelay += delay;
      worstDelay = Math.max(worstDelay, delay);
    } else {
      onTime += 1;
    }
  }

  const settled = onTime + late;
  const averageDelay = late > 0 ? Math.round((totalDelay / late) * 10) / 10 : 0;

  /*
   * Verdictul nu se dă din două tranșe: două întârzieri la rând pot fi o lună
   * proastă, nu un om. De la trei în sus începe să însemne ceva.
   */
  let verdict: Punctuality["verdict"] = "necunoscut";
  if (settled >= 3) {
    const lateShare = late / settled;
    verdict = lateShare <= 0.2 ? "bun" : lateShare <= 0.5 ? "mediu" : "greu";
  }

  return {
    onTime,
    late,
    averageDelay,
    worstDelay,
    overdue,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    verdict,
  };
}
