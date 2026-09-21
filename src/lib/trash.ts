import { store } from "./db/store";
import { TABLE_NAMES } from "./types";
import type { TableName, Tables } from "./types";

/**
 * Coșul de gunoi.
 *
 * Ștergerile au fost dintotdeauna logice — rândurile rămân în bază cu
 * `deleted_at` — dar din aplicație nu exista niciun drum înapoi. O apăsare
 * greșită era definitivă pentru om, deși datele erau la un metru distanță.
 *
 * Un grup e tot ce a fost șters în aceeași clipă: lucrarea și tot ce atârna de
 * ea poartă același `deleted_at`, pus o singură dată de `removeMany`. De aceea
 * restaurarea nu trebuie să ghicească nimic.
 */

/** Tabelele care merită arătate ca „lucrul șters”; restul sunt copii. */
const HEADLINE: TableName[] = [
  "jobs",
  "clients",
  "quotes",
  "invoices",
  "handovers",
  "job_measurements",
  "materials",
  "tools",
  "expenses",
  "payments",
  "fixed_costs",
];

export const TRASH_LABELS: Partial<Record<TableName, string>> = {
  jobs: "Lucrare",
  clients: "Client",
  quotes: "Ofertă",
  invoices: "Factură",
  handovers: "Proces-verbal",
  job_measurements: "Măsurătoare",
  materials: "Material",
  tools: "Sculă",
  expenses: "Cheltuială",
  payments: "Plată",
  fixed_costs: "Cheltuială fixă",
};

export interface TrashItem {
  /** Clipa ștergerii: cheia grupului și cea cu care se restaurează. */
  at: string;
  table: TableName;
  id: string;
  title: string;
  /** Câte rânduri se întorc odată cu el. */
  count: number;
}

function titleOf(table: TableName, row: Tables[TableName]): string {
  const value = row as unknown as Record<string, unknown>;
  for (const key of ["title", "name", "label", "client_name"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  if (typeof value.number === "number") return `nr. ${value.number}`;
  return TRASH_LABELS[table] ?? table;
}

/**
 * Ce s-a șters în ultimele `days` zile, grupat pe clipa ștergerii.
 *
 * Mai vechi de atât nu arătăm: un coș fără fund devine un al doilea depozit de
 * date, pe care nimeni nu-l mai citește.
 */
export function trashItems(days = 30): TrashItem[] {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const groups = new Map<string, TrashItem>();
  const counts = new Map<string, number>();

  for (const table of TABLE_NAMES) {
    for (const row of store.getTable(table)) {
      const at = row.deleted_at;
      if (!at || at < cutoff) continue;
      counts.set(at, (counts.get(at) ?? 0) + 1);
      const known = groups.get(at);
      // Rândul „principal” al grupului dă numele; un copil nu-l înlocuiește.
      if (known && HEADLINE.indexOf(known.table) <= HEADLINE.indexOf(table)) {
        continue;
      }
      if (!known && !HEADLINE.includes(table)) continue;
      groups.set(at, {
        at,
        table,
        id: row.id,
        title: titleOf(table, row),
        count: 0,
      });
    }
  }

  return [...groups.values()]
    .map((item) => ({ ...item, count: counts.get(item.at) ?? 1 }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function restoreTrash(at: string): Promise<number> {
  return store.restoreBatch(at);
}
