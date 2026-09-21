/**
 * Comanda către furnizor.
 *
 * Lista de cumpărături exista, dar era o listă plată: bună de bifat la
 * magazin, inutilă pentru un depozit care întreabă „ce-ți trebuie?". Grupată
 * pe furnizor și scrisă ca text, devine o comandă pe care o trimiți.
 */
import { formatNumber } from "./format";
import type { JobMaterial } from "./types";

/** Cum îi spunem grupului când materialul n-are furnizor știut. */
export const NO_SUPPLIER = "Fără furnizor";

export interface OrderLine {
  name: string;
  quantity: number;
  unit: string;
}

export interface SupplierOrder {
  supplier: string;
  lines: OrderLine[];
}

/**
 * Strânge materialele pe furnizor, adunând ce se repetă.
 *
 * Trei lucrări care cer același parchet fac o singură linie: depozitul
 * livrează metri, nu lucrări.
 */
export function groupBySupplier(
  items: { material: JobMaterial; supplier: string | null }[],
): SupplierOrder[] {
  const groups = new Map<string, Map<string, OrderLine>>();

  for (const { material, supplier } of items) {
    const key = (supplier ?? "").trim() || NO_SUPPLIER;
    const lines = groups.get(key) ?? new Map<string, OrderLine>();
    const name = material.name.trim() || "Material";
    const unit = material.unit || "buc";
    const lineKey = `${name.toLowerCase()}|${unit.toLowerCase()}`;
    const existing = lines.get(lineKey);
    if (existing) existing.quantity += Number(material.quantity) || 0;
    else lines.set(lineKey, { name, unit, quantity: Number(material.quantity) || 0 });
    groups.set(key, lines);
  }

  return [...groups.entries()]
    .map(([supplier, lines]) => ({
      supplier,
      lines: [...lines.values()].sort((a, b) => a.name.localeCompare(b.name, "ro")),
    }))
    // Furnizorii cunoscuți primii; „fără furnizor" e o grămadă, nu o comandă.
    .sort((a, b) => {
      if (a.supplier === NO_SUPPLIER) return 1;
      if (b.supplier === NO_SUPPLIER) return -1;
      return a.supplier.localeCompare(b.supplier, "ro");
    });
}

/** Textul comenzii, așa cum îl citește omul de la depozit. */
export function orderText(order: SupplierOrder, from?: string | null): string {
  const head =
    order.supplier === NO_SUPPLIER ? "Comandă materiale" : `Comandă — ${order.supplier}`;
  const lines = order.lines.map(
    (line) => `• ${line.name} — ${formatNumber(line.quantity)} ${line.unit}`,
  );
  const signature = from?.trim() ? [`\n${from.trim()}`] : [];
  return [head, "", ...lines, ...signature].join("\n");
}

/** Linkul care deschide WhatsApp cu comanda deja scrisă. */
export function whatsappHref(text: string, phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Mementoul trimis clientului pentru o ofertă neconfirmată.
 *
 * Scurt și fără reproș: omul n-a uitat din rea-voință, iar o ofertă care
 * sună a somație se închide, nu se semnează.
 */
export function reminderText(input: {
  clientName: string | null;
  number: string;
  title: string;
  url: string;
  from: string | null;
}): string {
  const hello = input.clientName?.trim()
    ? `Bună ziua, ${input.clientName.trim()}!`
    : "Bună ziua!";
  const signature = input.from?.trim() ? `\n\n${input.from.trim()}` : "";
  return (
    `${hello}\n\n` +
    `Vă scriu în legătură cu oferta ${input.number} — ${input.title}. ` +
    `O puteți vedea aici:\n${input.url}\n\n` +
    `Rămân la dispoziție dacă aveți întrebări.${signature}`
  );
}
