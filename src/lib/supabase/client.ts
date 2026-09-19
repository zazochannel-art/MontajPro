"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientul Supabase din browser.
 *
 * Aplicația funcționează și fără Supabase configurat (mod local): în acel caz
 * `isSupabaseConfigured` este `false`, datele rămân în IndexedDB pe telefon, iar
 * interfața anunță clar că sincronizarea în cloud este oprită.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith("http"),
);

export const PHOTO_BUCKET = "job-photos";

let client: SupabaseClient | null = null;
let injected: SupabaseClient | null = null;

/**
 * Înlocuiește clientul — folosit de teste, care pornesc un PostgREST fals și
 * verifică sincronizarea cu clientul adevărat, nu cu unul simulat.
 */
export function setSupabaseClient(next: SupabaseClient | null) {
  injected = next;
}

export function getSupabase(): SupabaseClient | null {
  if (injected) return injected;
  if (!isSupabaseConfigured) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
