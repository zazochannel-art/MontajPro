/**
 * Clientul dublat.
 *
 * „Ion Popescu" se poate adăuga de trei ori, cu același telefon scris de
 * fiecare dată altfel. Istoricul lui se sparge atunci în trei bucăți, iar
 * întrebarea „cât mi-a plătit omul ăsta până acum?" nu mai are răspuns.
 *
 * Se prinde la adăugare, când e încă ieftin de reparat, și se poate repara și
 * după, prin unire.
 */
import type { Client, TableName } from "./types";

/** Tabelele care poartă un `client_id` — toate cele care se mută la unire. */
export const CLIENT_TABLES: TableName[] = [
  "jobs",
  "projects",
  "job_measurements",
  "payments",
  "quotes",
  "invoices",
  "handovers",
];

/**
 * Telefonul, redus la ce contează.
 *
 * „+373 69 123 456", „069123456" și „00373069123456" sunt același om. Ținem
 * ultimele opt cifre: prefixele de țară și zerourile de acces diferă de la un
 * telefon la altul, restul numărului nu.
 */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return digits.slice(-8);
}

/** Numele, redus la ce contează: fără diacritice, spații sau majuscule. */
export function nameKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export interface DuplicateMatch {
  client: Client;
  /** După ce s-a potrivit: telefonul e dovadă, numele e doar un semn. */
  by: "phone" | "name";
}

/**
 * Clienții care par a fi același om.
 *
 * Telefonul e o potrivire tare; numele, una slabă — există doi Ion Popescu în
 * fiecare oraș. De aceea `by` ajunge până în interfață: după telefon spunem
 * „e același", după nume doar întrebăm.
 */
export function findDuplicates(
  clients: Client[],
  input: { name?: string | null; phone?: string | null; excludeId?: string | null },
): DuplicateMatch[] {
  const phone = phoneKey(input.phone);
  const name = nameKey(input.name);
  if (!phone && name.length < 4) return [];

  const matches: DuplicateMatch[] = [];
  for (const client of clients) {
    if (client.deleted_at || client.id === input.excludeId) continue;
    if (phone && phoneKey(client.phone) === phone) {
      matches.push({ client, by: "phone" });
      continue;
    }
    if (name && name.length >= 4 && nameKey(client.name) === name) {
      matches.push({ client, by: "name" });
    }
  }

  // Potrivirea după telefon merită văzută prima.
  return matches.sort((a, b) => (a.by === b.by ? 0 : a.by === "phone" ? -1 : 1));
}
