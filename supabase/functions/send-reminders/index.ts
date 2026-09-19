/**
 * Trimite notificările push zilnice.
 *
 * Rulează pe cron (vezi `supabase/migrations/0004_cron.sql`), o dată pe zi,
 * dimineața. Regulile — ce anume merită trimis — stau în SQL, în
 * `public.due_reminders()`, ca să nu depindă de aplicație.
 *
 * Secretele vin din două locuri: întâi din variabilele de mediu ale funcției
 * (`supabase secrets set`), iar dacă lipsesc, din Vault-ul bazei, prin
 * `public.push_config()` — funcție pe care o poate chema doar `service_role`.
 * Așa proiectul poate fi configurat numai din SQL.
 *
 * Protecție: cere antetul `x-cron-secret` și refuză tot dacă secretul nu e
 * configurat. Funcția e publicată fără verificarea JWT tocmai pentru că își
 * face singură verificarea: un JWT oarecare de utilizator ar fi trecut de
 * verificarea platformei și ar fi putut declanșa notificări pentru toți.
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Reminder {
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  job_id: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushConfig {
  vapid_subject: string | null;
  vapid_public: string | null;
  vapid_private: string | null;
  cron_secret: string | null;
}

type Supa = ReturnType<typeof createClient>;

/** Mediul bate baza; ce lipsește din mediu se cere din Vault. */
async function loadConfig(supabase: Supa): Promise<PushConfig> {
  const fromEnv: PushConfig = {
    vapid_subject: Deno.env.get("VAPID_SUBJECT") ?? null,
    vapid_public: Deno.env.get("VAPID_PUBLIC_KEY") ?? null,
    vapid_private: Deno.env.get("VAPID_PRIVATE_KEY") ?? null,
    cron_secret: Deno.env.get("CRON_SECRET") ?? null,
  };

  const complete = fromEnv.vapid_public && fromEnv.vapid_private && fromEnv.cron_secret;
  if (complete) return fromEnv;

  const { data } = await supabase.rpc("push_config");
  const fromVault = (Array.isArray(data) ? data[0] : data) as PushConfig | undefined;

  return {
    vapid_subject: fromEnv.vapid_subject ?? fromVault?.vapid_subject ?? null,
    vapid_public: fromEnv.vapid_public ?? fromVault?.vapid_public ?? null,
    vapid_private: fromEnv.vapid_private ?? fromVault?.vapid_private ?? null,
    cron_secret: fromEnv.cron_secret ?? fromVault?.cron_secret ?? null,
  };
}

/** Comparație în timp constant: un secret nu se ghicește caracter cu caracter. */
function secretsMatch(expected: string, received: string): boolean {
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(received);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (request) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const config = await loadConfig(supabase);

  // Fără secret configurat nu deschidem ușa „doar de data asta”.
  const presented = request.headers.get("x-cron-secret") ?? "";
  if (!config.cron_secret || !secretsMatch(config.cron_secret, presented)) {
    return new Response("Nepermis", { status: 401 });
  }

  if (!config.vapid_public || !config.vapid_private) {
    return Response.json({ error: "cheile VAPID lipsesc" }, { status: 500 });
  }

  webpush.setVapidDetails(
    config.vapid_subject ?? "mailto:noreply@montajpro.app",
    config.vapid_public,
    config.vapid_private,
  );

  const { data: reminders, error: remindersError } = await supabase.rpc("due_reminders");
  if (remindersError) {
    return Response.json({ error: remindersError.message }, { status: 500 });
  }

  const list = (reminders ?? []) as Reminder[];
  if (!list.length) return Response.json({ sent: 0, reason: "nimic de trimis" });

  const userIds = [...new Set(list.map((item) => item.user_id))];
  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (subsError) {
    return Response.json({ error: subsError.message }, { status: 500 });
  }

  const byUser = new Map<string, Subscription[]>();
  for (const sub of (subs ?? []) as Subscription[]) {
    byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub]);
  }

  let sent = 0;
  const dead: string[] = [];

  for (const reminder of list) {
    const targets = byUser.get(reminder.user_id) ?? [];
    const payload = JSON.stringify({
      title: reminder.title,
      body: reminder.body ?? "",
      tag: `${reminder.kind}:${reminder.job_id ?? ""}`,
      url: reminder.job_id ? `/lucrari/${reminder.job_id}` : "/notificari",
    });

    for (const target of targets) {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          payload,
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: browserul a șters abonamentul. Îl scoatem și noi, altfel
        // încercăm zilnic în gol.
        if (status === 404 || status === 410) dead.push(target.id);
      }
    }
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return Response.json({ sent, reminders: list.length, removed: dead.length });
});
