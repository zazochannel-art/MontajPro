"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Wrench } from "lucide-react";
import { useTable } from "@/hooks/use-data";
import { useT } from "@/hooks/use-t";
import { packList } from "@/lib/packing";
import type { Job } from "@/lib/types";

/**
 * Ce scule iei azi, bifate pe rând în timp ce încarci mașina.
 *
 * Bifele trăiesc doar cât ține pagina: e o listă de încărcat, nu o evidență.
 * Mâine lucrările sunt altele, deci și lista e alta.
 */
export function PackList({ jobs }: { jobs: Job[] }) {
  const t = useT();
  const tools = useTable("tools");
  const list = useMemo(() => packList(tools, jobs), [tools, jobs]);
  const [packed, setPacked] = useState<Set<string>>(new Set());

  if (list.tools.length === 0) {
    // Nimic de listat: ori n-ai scule, ori niciuna nu e legată de ziua asta.
    if (list.untagged === 0 || jobs.length === 0) return null;
    return (
      <p className="rounded-2xl surface p-4 text-sm text-muted-foreground">
        <Wrench className="mr-1.5 inline size-4" />
        Spune la ce lucrări îți trebuie fiecare sculă și dimineața îți facem
        lista de încărcat.{" "}
        <Link href="/scule" className="text-primary hover:underline">
          Sculele tale
        </Link>
      </p>
    );
  }

  const done = list.tools.filter((tool) => packed.has(tool.id)).length;

  return (
    <section className="space-y-2.5 rounded-2xl surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="size-4 text-primary" /> {t("De luat azi")}
        </h4>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done}/{list.tools.length}
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {list.tools.map((tool) => {
          const on = packed.has(tool.id);
          return (
            <li key={tool.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setPacked((current) => {
                    const next = new Set(current);
                    if (!next.delete(tool.id)) next.add(tool.id);
                    return next;
                  })
                }
                className={
                  on
                    ? "flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/12 px-3 py-1.5 text-sm font-medium text-primary line-through transition-transform duration-[--dur-1] active:scale-95"
                    : "flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-[background-color,transform] duration-[--dur-1] hover:bg-accent active:scale-95"
                }
              >
                {on && <Check className="size-3.5" />}
                {tool.name}
              </button>
            </li>
          );
        })}
      </ul>

      {list.untagged > 0 && (
        <p className="text-xs text-muted-foreground">
          {list.untagged}{" "}
          {list.untagged === 1 ? "sculă n-are" : "scule n-au"} niciun tip pus.{" "}
          <Link href="/scule" className="text-primary hover:underline">
            Pune-le
          </Link>
        </p>
      )}
    </section>
  );
}
