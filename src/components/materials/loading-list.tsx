"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PackageMinus, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { useT } from "@/hooks/use-t";
import { takeFromStock } from "@/lib/db/actions";
import { loadingList } from "@/lib/loading";
import { formatDateShort, formatNumber, todayKey } from "@/lib/format";

/** Câte zile în față se încarcă: azi și mâine. */
function nextDays(count: number): string[] {
  const start = Date.parse(`${todayKey()}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Ce iei de pe raft pentru zilele care vin.
 *
 * Lista de cumpărături lasă dinadins afară ce ai deja în depozit, iar lista
 * de scule acoperă sculele. Rămânea exact golul din mijloc: materialele care
 * sunt la tine și îți trebuie mâine. Alea le țineai minte.
 */
export function LoadingList({ days = 2 }: { days?: number }) {
  const t = useT();
  const jobs = useAllJobs();
  const materials = useTable("job_materials");
  const stock = useTable("materials");

  const lines = useMemo(
    () => loadingList(jobs, materials, stock, nextDays(days)),
    [jobs, materials, stock, days],
  );

  if (!lines.length) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="size-4 text-primary" /> {t("De încărcat din depozit")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {lines.length} {lines.length === 1 ? "material" : "materiale"}
        </span>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {lines.map(({ material, job, stock: row, available, short }) => (
          <li key={material.id} className="flex items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{material.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatNumber(material.quantity)} {material.unit} pentru{" "}
                <Link href={`/lucrari/${job.id}`} className="hover:underline">
                  {job.title}
                </Link>
                {job.scheduled_date && ` · ${formatDateShort(job.scheduled_date)}`}
              </p>
              <p
                className={`text-[11px] ${short ? "text-amber-300" : "text-muted-foreground"}`}
              >
                {short
                  ? `în depozit doar ${formatNumber(available)} ${row.unit}`
                  : `în depozit: ${formatNumber(available)} ${row.unit}`}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const result = await takeFromStock(material.id);
                if (!result) return;
                toast.success(
                  result.short > 0
                    ? `Ai luat tot ce era; lipsesc ${formatNumber(result.short)} ${material.unit}`
                    : "Scos din depozit",
                );
              }}
            >
              <PackageMinus /> Iau
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
