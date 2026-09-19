"use client";

import { getSupabase, isSupabaseConfigured } from "./supabase/client";

/**
 * Notificări push.
 *
 * Abonamentul aparține unui browser, nu contului: nu trece prin sincronizarea
 * local-first, ci se scrie direct în `push_subscriptions`. Dacă cheia VAPID
 * lipsește sau browserul nu suportă push (iOS neinstalat ca aplicație), totul
 * degradează la notificările din aplicație.
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState =
  | "unsupported"
  | "not-configured"
  | "denied"
  | "enabled"
  | "disabled";

/** Cheia VAPID vine în base64url; API-ul cere octeți. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!isSupabaseConfigured || !VAPID_PUBLIC_KEY) return "not-configured";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "enabled" : "disabled";
}

function keyToBase64(subscription: PushSubscription, name: "p256dh" | "auth"): string {
  const key = subscription.getKey(name);
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

/** Cere permisiunea, se abonează și salvează abonamentul. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!isSupabaseConfigured || !VAPID_PUBLIC_KEY) return "not-configured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "disabled";

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const supabase = getSupabase();
  if (!supabase) return "not-configured";

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: keyToBase64(subscription, "p256dh"),
      auth: keyToBase64(subscription, "auth"),
      user_agent: navigator.userAgent.slice(0, 200),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);

  return "enabled";
}

/** Dezabonare: dispare și din browser, și din baza de date. */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return "disabled";

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = getSupabase();
  if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  return "disabled";
}
