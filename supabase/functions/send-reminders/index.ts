/**
 * Trimite notificările push zilnice.
 *
 * Rulează pe cron (vezi `supabase/migrations/0004_cron.sql`), o dată pe zi,
 * dimineața. Regulile — ce anume merită trimis — stau în SQL, în
 * `public.due_reminders()`, ca să nu depindă de aplicație.
 *
 * Protecție: cere antetul `x-cron-secret`, altfel oricine ar putea declanșa
 * notificări. Secretele se pun cu `supabase secrets set`.
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@montajpro.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

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

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (request) => {
  if (CRON_SECRET && request.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Nepermis", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

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
