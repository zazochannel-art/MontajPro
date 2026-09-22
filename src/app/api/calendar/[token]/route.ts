import { createClient } from "@supabase/supabase-js";
import { buildIcs } from "@/lib/ics";

/**
 * Calendarul, ca abonament în telefon.
 *
 * Telefonul cere adresa asta din când în când și primește un fișier `.ics`.
 * Nu se poate face din browser, fiindcă agenda telefonului nu execută
 * JavaScript: are nevoie de text simplu, servit direct.
 *
 * Datele vin dintr-o funcție din bază care rulează cu drepturile definitorului
 * și întoarce doar titlul, ziua, ora și adresa. Fără prețuri, fără clienți,
 * fără note — cine are linkul vede când ești ocupat, nu cu ce te ocupi.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return new Response("Sincronizarea în cloud nu este configurată", {
      status: 503,
    });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("calendar_by_token", { token });
  if (error) return new Response("Eroare", { status: 500 });
  if (!data) return new Response("Calendarul nu a fost găsit", { status: 404 });

  const calendar = data as {
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
  };

  const ics = buildIcs({
    name: calendar.name,
    jobs: calendar.jobs,
    blocks: calendar.blocks,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Agendele reîmprospătează singure; o oră e des destul și nu încarcă.
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": 'inline; filename="montcraft.ics"',
    },
  });
}
