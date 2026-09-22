"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { useT } from "@/hooks/use-t";
import { toggleJobTask } from "@/lib/db/actions";
import { openCount, openTasks } from "@/lib/todo";
import { formatDateShort } from "@/lib/format";
import { JOB_TYPE_EMOJI } from "@/lib/constants";

/** Câte lucrări se arată înainte de „vezi tot”. */
const SHOWN = 3;

/**
 * Tot ce-ți stă nebifat, pe toate lucrările.
 *
 * Checklistul exista de mult, dar îl vedeai doar intrând în lucrare — adică
 * exact atunci când erai deja acolo. Dimineața întrebarea e alta: ce am de
 * terminat azi, în total? Se poate și bifa de aici, fără să intri.
 */
export function OpenTasks() {
  const t = useT();
  const jobs = useAllJobs();
  const tasks = useTable("job_tasks");
  const [all, setAll] = useState(false);

  const todos = useMemo(() => openTasks(tasks, jobs), [tasks, jobs]);
  if (!todos.length) return null;

  const total = openCount(todos);
  const shown = all ? todos : todos.slice(0, SHOWN);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="size-5 text-primary" /> {t("De terminat")}
        </h3>
        <span className="text-sm text-muted-foreground">
          {total} {total === 1 ? "pas" : "pași"}
        </span>
      </div>

      <div className="space-y-2.5">
        {shown.map(({ job, tasks: open, total: steps }) => (
          <div key={job.id} className="space-y-2 rounded-2xl surface p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/lucrari/${job.id}`}
                className="min-w-0 truncate text-sm font-medium hover:underline"
              >
                {JOB_TYPE_EMOJI[job.type]} {job.title}
              </Link>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {steps - open.length}/{steps}
                {job.scheduled_date && ` · ${formatDateShort(job.scheduled_date)}`}
              </span>
            </div>

            <ul className="space-y-1.5">
              {open.map((task) => (
                <li key={task.id} className="flex items-center gap-2.5">
                  <Checkbox
                    checked={false}
                    aria-label={`Bifează „${task.title}”`}
                    onCheckedChange={() => void toggleJobTask(task.id, true)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {todos.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((open) => !open)}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {all ? "Arată mai puțin" : `Încă ${todos.length - SHOWN} lucrări`}
          <ChevronDown
            className={`size-4 transition-transform duration-[--dur-2] ${all ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}
