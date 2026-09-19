"use client";

import { getSupabase, isSupabaseConfigured } from "./client";

/**
 * Oferta văzută de client, prin link.
 *
 * Nu atinge tabelele direct: totul trece prin două funcții din bază
 * (`quote_by_token`, `accept_quote`), care rulează cu drepturi de definitor.
 * Așa, cineva care deschide linkul nu capătă acces la nimic altceva.
 */

export interface PublicQuoteItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface PublicQuote {
  id: string;
  number: number;
  title: string;
  status: "sent" | "accepted" | "rejected";
  advance: number;
  discount: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
  accepted_by_client_at: string | null;
  client_signature: string | null;
  currency: string;
  client: { name: string; address: string | null } | null;
  issuer: { name: string | null; phone: string | null; email: string | null };
  items: PublicQuoteItem[];
}

export type PublicQuoteResult =
  | { state: "ok"; quote: PublicQuote }
  | { state: "not-found" }
  | { state: "no-backend" }
  | { state: "error"; message: string };

export async function fetchPublicQuote(token: string): Promise<PublicQuoteResult> {
  if (!isSupabaseConfigured) return { state: "no-backend" };
  const supabase = getSupabase();
  if (!supabase) return { state: "no-backend" };

  const { data, error } = await supabase.rpc("quote_by_token", { token });
  if (error) return { state: "error", message: error.message };
  if (!data) return { state: "not-found" };
  return { state: "ok", quote: data as PublicQuote };
}

export async function acceptPublicQuote(
  token: string,
  signer: string,
): Promise<PublicQuoteResult> {
  const supabase = getSupabase();
  if (!supabase) return { state: "no-backend" };

  const { data, error } = await supabase.rpc("accept_quote", { token, signer });
  if (error) return { state: "error", message: error.message };
  if (!data) return { state: "not-found" };
  return { state: "ok", quote: data as PublicQuote };
}

/** Linkul de trimis clientului. */
export function publicQuoteUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/oferta/${token}`;
}
