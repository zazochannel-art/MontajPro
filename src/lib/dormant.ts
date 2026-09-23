/**
 * Materialul care doarme pe raft.
 *
 * „Pune restul în stoc” există tocmai ca să nu cumperi din nou ce ai deja în
 * pod. Dar nimic nu se uită înapoi: parchetul pus acolo acum opt luni, pe care
 * nicio lucrare nu l-a mai atins, sunt bani care stau. Nu e o pierdere — e o
 * listă de „ce pot da mai ieftin la următoarea ofertă”.
 *
 * Ultima folosire se ia din lucrările pe care materialul a fost pus, nu din
 * rândul de depozit: `materials.updated_at` se schimbă și când îi corectezi
 * prețul, ceea ce n-are nicio legătură cu mișcarea de pe raft.
 */
import { num } from "./utils";
import { jobDate } from "./reports";
import type { Job, JobMaterial, Material } from "./types";

/** De la atâtea luni fără mișcare, materialul doarme. */
export const DORMANT_MONTHS = 6;

export interface DormantLine {
  material: Material;
  /** Ce face cantitatea de pe raft, la prețul ei. */
  value: number;
  /** Ultima zi în care a intrat într-o lucrare, dacă a intrat vreodată. */
  lastUsed: string | null;
  /** De câte luni stă. */
  months: number;
  /** N-a fost folosit niciodată, doar cumpărat. */
  never: boolean;
}

export interface DormantStock {
  lines: DormantLine[];
  /** Cât fac la un loc banii care dorm. */
  total: number;
}

function monthsBetween(from: string, today: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / (30 * 86_400_000)));
}

/**
 * Ce stă pe raft de prea mult timp.
 *
 * Intră doar ce are cantitate și preț: fără preț n-ai ce socoti, iar fără
 * cantitate nu stă nimic acolo. Se numără de la ultima lucrare pe care a
 * intrat; dacă n-a intrat pe niciuna, de când a fost adăugat în depozit.
 */
export function dormantStock(
  stock: Material[],
  used: JobMaterial[],
  jobs: Job[],
  today: string,
  months = DORMANT_MONTHS,
): DormantStock {
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  /** material_id -> cea mai recentă zi de lucrare pe care a fost pus. */
  const lastByMaterial = new Map<string, string>();
  for (const line of used) {
    if (line.deleted_at || !line.material_id) continue;
    const job = jobById.get(line.job_id);
    if (!job || job.deleted_at) continue;
    const day = jobDate(job).slice(0, 10);
    const known = lastByMaterial.get(line.material_id);
    if (!known || day > known) lastByMaterial.set(line.material_id, day);
  }

  const lines: DormantLine[] = [];
  for (const material of stock) {
    if (material.deleted_at) continue;
    const quantity = num(material.quantity);
    const price = num(material.price);
    if (quantity <= 0 || price <= 0) continue;

    const lastUsed = lastByMaterial.get(material.id) ?? null;
    const since = lastUsed ?? material.created_at;
    const age = monthsBetween(since, today);
    if (age < months) continue;

    lines.push({
      material,
      value: Math.round(quantity * price * 100) / 100,
      lastUsed,
      months: age,
      never: !lastUsed,
    });
  }

  lines.sort((a, b) => b.value - a.value || b.months - a.months);

  return {
    lines,
    total: Math.round(lines.reduce((acc, line) => acc + line.value, 0) * 100) / 100,
  };
}
