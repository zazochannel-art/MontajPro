/**
 * Ce mai e în garanție.
 *
 * Garanția se scria pe procesul-verbal și primeai o notificare cu 30 de zile
 * înainte să expire. Ce lipsea era răspunsul pe loc: sună omul în luna a opta
 * că scârțâie o treaptă, iar tu trebuie să știi din două atingeri dacă mergi
 * pe banii tăi sau pe ai lui.
 */
import { daysUntil, warrantyEndDate } from "./calc";
import { phoneKey } from "./clients";
import { toDateKey } from "./format";
import type { Client, Handover, Job } from "./types";

export type WarrantyState = "active" | "expiring" | "expired";

export interface WarrantyRow {
  handover_id: string;
  job_id: string;
  job_title: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  handed_at: string;
  /** ISO date (YYYY-MM-DD). */
  ends_on: string;
  /** Negativ după expirare. */
  days_left: number;
  state: WarrantyState;
}

/** Sub atâtea zile, garanția se consideră „pe terminate”. */
const EXPIRING_DAYS = 30;

/**
 * Lucrările predate, cu garanția lor, cea mai apropiată de expirare prima.
 *
 * Predările fără termen de garanție nu apar: n-au ce să expire, iar o listă
 * plină de rânduri fără dată n-ar mai fi de folos nimănui.
 */
export function warrantyRows(
  handovers: Handover[],
  jobs: Job[],
  clients: Client[],
  now: Date = new Date(),
): WarrantyRow[] {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const rows: WarrantyRow[] = [];

  for (const handover of handovers) {
    if (handover.deleted_at) continue;
    const end = warrantyEndDate(handover.handed_at, handover.warranty_months);
    if (!end) continue;

    const job = jobById.get(handover.job_id);
    const client = handover.client_id ? clientById.get(handover.client_id) : null;
    const days = daysUntil(end, now) ?? 0;

    rows.push({
      handover_id: handover.id,
      job_id: handover.job_id,
      job_title: job?.title ?? handover.work_summary ?? "Lucrare",
      client_id: handover.client_id,
      client_name: client?.name ?? handover.client_name ?? "Client",
      client_phone: client?.phone ?? handover.client_phone ?? null,
      handed_at: handover.handed_at,
      ends_on: toDateKey(end),
      days_left: days,
      state: days < 0 ? "expired" : days <= EXPIRING_DAYS ? "expiring" : "active",
    });
  }

  return rows.sort((a, b) => a.days_left - b.days_left);
}

/** Doar ce e încă acoperit — ce caută omul când îi sună telefonul. */
export function activeWarranties(rows: WarrantyRow[]): WarrantyRow[] {
  return rows.filter((row) => row.state !== "expired");
}

/**
 * Caută după numele clientului, telefon sau titlul lucrării.
 *
 * Telefonul trece prin `phoneKey`, aceeași regulă după care aplicația decide
 * că doi clienți sunt același om: ultimele opt cifre. Prefixul de țară și
 * zeroul de acces diferă de la un telefon la altul — „+373 69 123 456” și
 * „069123456” sunt același număr, iar omul care caută tastează ce-și amintește,
 * nu ce scrie în agendă.
 */
export function searchWarranties(rows: WarrantyRow[], query: string): WarrantyRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;

  // Cifrele căutate, aduse la aceeași formă ca ale numărului din agendă.
  const typed = needle.replace(/\D/g, "");
  const wanted = typed.length >= 6 ? phoneKey(typed) : typed;

  return rows.filter((row) => {
    if (row.client_name.toLowerCase().includes(needle)) return true;
    if (row.job_title.toLowerCase().includes(needle)) return true;
    if (wanted.length >= 3 && row.client_phone) {
      return phoneKey(row.client_phone).includes(wanted);
    }
    return false;
  });
}

/**
 * Ce te-au costat revenirile în garanție.
 *
 * Nu există un bifat „a fost gratis”: se citește din banii lucrării. O
 * revenire cu preț zero e pe banii tăi; una cu preț e muncă plătită, care
 * întâmplător s-a nimerit la un client vechi.
 */
export interface WarrantyCost {
  /** Câte reveniri, în total. */
  visits: number;
  /** Câte n-au adus niciun ban. */
  free: number;
  /** Cât ai încasat din cele plătite. */
  earned: number;
}

export function warrantyCost(jobs: Job[]): WarrantyCost {
  const callbacks = jobs.filter(
    (job) => !job.deleted_at && job.warranty_of_job_id,
  );
  let earned = 0;
  let free = 0;
  for (const job of callbacks) {
    if (job.price_total > 0) earned += job.price_total;
    else free += 1;
  }
  return { visits: callbacks.length, free, earned };
}
