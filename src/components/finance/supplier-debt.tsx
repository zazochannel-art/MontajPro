"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Undo2 } from "lucide-react";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { supplierDebt } from "@/lib/loading";
import { formatMoney, formatNumber } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

/**
 * Ce ai de recuperat de la furnizori.
 *
 * Materialul adus greșit se duce înapoi, iar banii rămân la ei până îi ceri.
 * Până acum nu-i ținea nimeni minte: se pierdeau între două lucrări, exact ca
 * restul de plată de la client, numai că în cealaltă direcție.
 */
export function SupplierDebt() {
  const { currency } = useApp();
  const materials = useTable("job_materials");
  const jobs = useAllJobs();

  const debt = useMemo(() => supplierDebt(materials), [materials]);
  if (!debt.lines.length) return null;

  const jobTitle = (id: string) =>
    jobs.find((job) => job.id === id)?.title ?? "Lucrare ștearsă";

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Undo2 className="size-4 text-primary" /> De recuperat de la furnizor
        </h2>
        <p className="text-sm font-semibold tabular-nums text-amber-300">
          {formatMoney(debt.total, currency)}
        </p>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {debt.lines.map(({ material, value }) => (
          <li
            key={material.id}
            className="flex items-center justify-between gap-3 p-3.5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{material.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatNumber(material.supplier_return_quantity)} {material.unit}{" "}
                ·{" "}
                <Link
                  href={`/lucrari/${material.job_id}?tab=materiale`}
                  className="hover:underline"
                >
                  {jobTitle(material.job_id)}
                </Link>
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatMoney(value, currency)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
