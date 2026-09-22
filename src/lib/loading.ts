/**
 * Ce încarci din depozit pentru zilele care vin.
 *
 * Lista de cumpărături lasă dinadins afară ce ai deja pe raft — n-are ce
 * căuta la magazin ceva ce ai acasă. Lista de scule acoperă sculele. Rămâne
 * exact golul din mijloc: materialele care sunt în depozit și îți trebuie
 * mâine. Alea le ții minte, sau te întorci după ele.
 */
import { num } from "./utils";
import { runsOn } from "./span";
import type { Job, JobMaterial, Material } from "./types";

export interface LoadLine {
  material: JobMaterial;
  job: Job;
  /** Rândul din depozit, pentru cantitate și unitate. */
  stock: Material;
  /** Cât mai e pe raft acum. */
  available: number;
  /** Depozitul n-are atât cât cere lucrarea. */
  short: boolean;
}

/**
 * Ce e de luat de pe raft pentru zilele date.
 *
 * Intră doar materialele legate de inventar (altfel n-ai de unde ști că sunt
 * la tine), necumpărate de la furnizor și nescoase încă din depozit. Ce s-a
 * scos deja e în mașină, nu pe raft.
 */
export function loadingList(
  jobs: Job[],
  materials: JobMaterial[],
  stock: Material[],
  days: string[],
): LoadLine[] {
  const wanted = new Set(days);
  const stockById = new Map(stock.filter((row) => !row.deleted_at).map((row) => [row.id, row]));

  const jobById = new Map(
    jobs
      .filter(
        (job) =>
          !job.deleted_at &&
          !job.archived_at &&
          job.status !== "done" &&
          job.status !== "on_hold" &&
          [...wanted].some((day) => runsOn(job, day)),
      )
      .map((job) => [job.id, job]),
  );

  const lines: LoadLine[] = [];
  for (const material of materials) {
    if (material.deleted_at) continue;
    if (material.purchased || material.taken_from_stock) continue;
    if (!material.material_id) continue;

    const job = jobById.get(material.job_id);
    if (!job) continue;
    const row = stockById.get(material.material_id);
    if (!row) continue;

    const available = num(row.quantity);
    // Ce nu e deloc pe raft ține de lista de cumpărături, nu de încărcat.
    if (available <= 0) continue;

    lines.push({
      material,
      job,
      stock: row,
      available,
      short: available < num(material.quantity),
    });
  }

  return lines.sort(
    (a, b) =>
      (a.job.scheduled_date ?? "").localeCompare(b.job.scheduled_date ?? "") ||
      a.material.name.localeCompare(b.material.name, "ro"),
  );
}

export interface SupplierDebt {
  /** Rândurile cu material dus înapoi la furnizor. */
  lines: { material: JobMaterial; value: number }[];
  /** Cât fac la un loc. */
  total: number;
}

/**
 * Cât îți datorează furnizorii pentru materialul dus înapoi.
 *
 * Valoarea iese din prețul de pe aceeași linie: ce ai plătit pe unitate e
 * exact ce ai de primit înapoi. Fără preț nu e o datorie de socotit, e o
 * cantitate.
 */
export function supplierDebt(materials: JobMaterial[]): SupplierDebt {
  const lines = materials
    .filter((row) => !row.deleted_at && num(row.supplier_return_quantity) > 0)
    .map((material) => ({
      material,
      value:
        Math.round(
          num(material.supplier_return_quantity) * num(material.unit_price) * 100,
        ) / 100,
    }))
    .filter((line) => line.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    lines,
    total: Math.round(lines.reduce((acc, line) => acc + line.value, 0) * 100) / 100,
  };
}
