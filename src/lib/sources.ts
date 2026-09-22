/**
 * De unde vine treaba.
 *
 * Răspunsul la „cine îmi aduce de lucru?” nu e o părere, e o adunare: se pune
 * fiecare leu încasat în dreptul canalului prin care a venit clientul.
 *
 * La un montator răspunsul e aproape mereu același — câțiva oameni aduc
 * jumătate din lucrări —, dar până nu-l vezi scris nu știi care sunt.
 */
import type { Client, ClientSource, Job, Payment } from "./types";

export interface SourceTotal {
  source: ClientSource | "unknown";
  clients: number;
  jobs: number;
  earned: number;
}

export interface ReferrerTotal {
  client_id: string;
  name: string;
  /** Câți clienți a trimis. */
  sent: number;
  /** Cât ai încasat de la oamenii trimiși de el. */
  earned: number;
}

/** Cât a adus fiecare canal, canalul cu cei mai mulți bani primul. */
export function totalsBySource(
  clients: Client[],
  jobs: Job[],
  payments: Payment[],
): SourceTotal[] {
  const sourceByClient = new Map<string, ClientSource | "unknown">();
  for (const client of clients) {
    if (client.deleted_at) continue;
    sourceByClient.set(client.id, client.source ?? "unknown");
  }

  const clientByJob = new Map<string, string | null>();
  for (const job of jobs) {
    if (job.deleted_at) continue;
    clientByJob.set(job.id, job.client_id);
  }

  const totals = new Map<ClientSource | "unknown", SourceTotal>();
  const bump = (key: ClientSource | "unknown") => {
    const row = totals.get(key) ?? { source: key, clients: 0, jobs: 0, earned: 0 };
    totals.set(key, row);
    return row;
  };

  for (const client of clients) {
    if (client.deleted_at) continue;
    bump(client.source ?? "unknown").clients += 1;
  }

  for (const job of jobs) {
    if (job.deleted_at || !job.client_id) continue;
    bump(sourceByClient.get(job.client_id) ?? "unknown").jobs += 1;
  }

  for (const payment of payments) {
    if (payment.deleted_at) continue;
    // Plata poate fi legată direct de client sau doar de lucrare.
    const clientId =
      payment.client_id ?? (payment.job_id ? clientByJob.get(payment.job_id) : null);
    if (!clientId) continue;
    bump(sourceByClient.get(clientId) ?? "unknown").earned += payment.amount;
  }

  return [...totals.values()].sort((a, b) => b.earned - a.earned);
}

/**
 * Cine te-a recomandat, și cât a valorat.
 *
 * Banii se numără de la oamenii pe care i-a trimis, nu de la el: ăsta e tot
 * rostul listei — să vezi cine ți-a adus clienți, nu cine ți-a plătit mult.
 */
export function topReferrers(
  clients: Client[],
  jobs: Job[],
  payments: Payment[],
): ReferrerTotal[] {
  const byId = new Map(clients.filter((c) => !c.deleted_at).map((c) => [c.id, c]));

  const clientByJob = new Map<string, string | null>();
  for (const job of jobs) {
    if (job.deleted_at) continue;
    clientByJob.set(job.id, job.client_id);
  }

  const earnedByClient = new Map<string, number>();
  for (const payment of payments) {
    if (payment.deleted_at) continue;
    const clientId =
      payment.client_id ?? (payment.job_id ? clientByJob.get(payment.job_id) : null);
    if (!clientId) continue;
    earnedByClient.set(clientId, (earnedByClient.get(clientId) ?? 0) + payment.amount);
  }

  const totals = new Map<string, ReferrerTotal>();
  for (const client of byId.values()) {
    const referrerId = client.referred_by_client_id;
    if (!referrerId) continue;
    const referrer = byId.get(referrerId);
    if (!referrer) continue;

    const row =
      totals.get(referrerId) ??
      { client_id: referrerId, name: referrer.name, sent: 0, earned: 0 };
    row.sent += 1;
    row.earned += earnedByClient.get(client.id) ?? 0;
    totals.set(referrerId, row);
  }

  return [...totals.values()].sort(
    (a, b) => b.earned - a.earned || b.sent - a.sent,
  );
}
