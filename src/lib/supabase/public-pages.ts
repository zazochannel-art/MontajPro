"use client";

import { getSupabase, isSupabaseConfigured } from "./client";

/**
 * Ce se vede prin linkurile publice: portofoliul și procesul-verbal.
 *
 * Aceeași alegere ca la ofertă — nimic nu atinge tabelele direct. Totul trece
 * prin funcții din bază care rulează cu drepturile definitorului și întorc
 * exact ce trebuie văzut. Cine deschide linkul nu capătă acces la altceva.
 */

/* ------------------------------ portofoliu --------------------------- */

export interface PublicPortfolioJob {
  id: string;
  title: string;
  type: string;
  description: string | null;
  done_at: string | null;
  /** Căi în bucket-ul `job-photos`, deschise doar cât linkul e pornit. */
  photos: string[];
}

export interface PublicPortfolio {
  intro: string | null;
  issuer: { name: string | null; phone: string | null; email: string | null };
  jobs: PublicPortfolioJob[];
}

export type PublicResult<T> =
  | { state: "ok"; data: T }
  | { state: "not-found" }
  | { state: "no-backend" }
  | { state: "error"; message: string };

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<PublicResult<T>> {
  if (!isSupabaseConfigured) return { state: "no-backend" };
  const supabase = getSupabase();
  if (!supabase) return { state: "no-backend" };

  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { state: "error", message: error.message };
  if (!data) return { state: "not-found" };
  return { state: "ok", data: data as T };
}

export function fetchPortfolio(token: string) {
  return callRpc<PublicPortfolio>("portfolio_by_token", { token });
}

/**
 * Adresa publică a unei poze din portofoliu.
 *
 * Bucket-ul rămâne privat; o politică lasă rolul anonim să citească exact
 * pozele lucrărilor marcate pentru portofoliu, cât timp linkul e pornit.
 */
export function portfolioPhotoUrl(storagePath: string): string | null {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = supabase.storage.from("job-photos").getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}

/* ------------------------- lucrarea, la client ----------------------- */

export interface PublicJob {
  title: string;
  type: string;
  status: string;
  address: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_date: string | null;
  end_date: string | null;
  issuer: { name: string | null; phone: string | null };
  tasks: { title: string; done: boolean }[];
  photos: { path: string; stage: string }[];
}

export function fetchJob(token: string) {
  return callRpc<PublicJob>("job_by_token", { token });
}

/**
 * Adresa publică a unei poze de pe o lucrare partajată.
 *
 * Aceeași alegere ca la portofoliu: bucket-ul rămâne privat, iar o politică
 * lasă rolul anonim să citească exact pozele lucrărilor cu link pornit.
 * Ștergi tokenul de pe lucrare și se închid la loc.
 */
export function jobPhotoUrl(storagePath: string): string | null {
  return portfolioPhotoUrl(storagePath);
}

/* --------------------------- proces-verbal --------------------------- */

export interface PublicHandover {
  id: string;
  number: number;
  handed_at: string;
  work_summary: string | null;
  warranty_months: number | null;
  notes: string | null;
  client_name: string | null;
  client_address: string | null;
  signed_by_client_at: string | null;
  client_signature_image: string | null;
  job_title: string | null;
  issuer: { name: string | null; phone: string | null; email: string | null };
}

export function fetchHandover(token: string) {
  return callRpc<PublicHandover>("handover_by_token", { token });
}

/** Semnătura clientului. A doua apăsare nu schimbă nimic. */
export function signHandover(token: string, signature: string) {
  return callRpc<PublicHandover>("sign_handover", { token, signature });
}

/* ------------------------------ calendar ----------------------------- */

export interface PublicCalendar {
  name: string;
  jobs: {
    id: string;
    title: string;
    address: string | null;
    date: string;
    time: string | null;
    hours: number | null;
  }[];
  blocks: { day: string; reason: string | null }[];
}

export function fetchCalendar(token: string) {
  return callRpc<PublicCalendar>("calendar_by_token", { token });
}
