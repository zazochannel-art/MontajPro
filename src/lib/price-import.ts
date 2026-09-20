import type { JobType, PriceItem } from "./types";
import { uid } from "./utils";

/**
 * Lista de prețuri, adusă dintr-un fișier.
 *
 * Fișierul vine din Excel, deci se presupune cel mai puțin: separatorul poate
 * fi `;` (cum scrie Excel-ul românesc), virgulă sau tab, iar zecimalele pot fi
 * cu virgulă. Un rând de antet se recunoaște singur, după faptul că prețul lui
 * nu e un număr.
 *
 * Coloane: nume; unitate; preț; [tip]
 */

const KIND_ALIASES: Record<string, JobType | "any"> = {
  scari: "stairs",
  scara: "stairs",
  stairs: "stairs",
  parchet: "parquet",
  parquet: "parquet",
  plinta: "plinth",
  plinte: "plinth",
  plinth: "plinth",
  altceva: "other",
  other: "other",
  oriunde: "any",
  any: "any",
  toate: "any",
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function detectSeparator(text: string): string {
  const line = text.split(/\r?\n/).find((row) => row.trim()) ?? "";
  if (line.includes(";")) return ";";
  if (line.includes("\t")) return "\t";
  return ",";
}

/** „1 350,50” → 1350.5; „1,350.50” → 1350.5 */
export function parseAmount(raw: string): number | null {
  const clean = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!clean) return null;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;
  if (lastComma > lastDot) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = clean.replace(/,/g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export interface PriceImportResult {
  items: PriceItem[];
  skipped: number;
}

export function parsePriceList(text: string): PriceImportResult {
  const separator = detectSeparator(text);
  const items: PriceItem[] = [];
  let skipped = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const [name, unit, price, kind] = cells;
    if (!name) {
      skipped++;
      continue;
    }
    const amount = parseAmount(price ?? "");
    if (amount === null) {
      // Cel mai probabil antetul fișierului; nu-l numărăm ca rând pierdut.
      skipped++;
      continue;
    }
    items.push({
      id: uid(),
      name,
      unit: unit || "buc",
      price: amount,
      kind: KIND_ALIASES[stripDiacritics(kind ?? "").toLowerCase()] ?? "any",
    });
  }

  return { items, skipped };
}

/** Aceeași formă, în sens invers, ca fișierul să poată fi dus și adus. */
export function priceListToCsv(items: PriceItem[]): string {
  const rows = [
    ["Denumire", "Unitate", "Preț", "Tip"].join(";"),
    ...items.map((item) =>
      [
        item.name,
        item.unit,
        String(item.price).replace(".", ","),
        item.kind,
      ].join(";"),
    ),
  ];
  return rows.join("\r\n");
}
