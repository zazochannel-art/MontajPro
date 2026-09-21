"use client";

import { useState } from "react";
import { ListChecks, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import {
  addJobTask,
  applyTaskTemplate,
  deleteJobTask,
  toggleJobTask,
} from "@/lib/db/actions";
import { DEFAULT_TASK_TEMPLATES, JOB_TYPE_LABELS } from "@/lib/constants";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pașii de pe șantier.
 *
 * Stau pe prima filă a lucrării pentru că ăsta e ecranul deschis cu mâinile
 * murdare — nu la a șaptea filă.
 */
export function TaskList({ job }: { job: Job }) {
  const { settings } = useApp();
  const tasks = useTable("job_tasks")
    .filter((task) => task.job_id === job.id)
    .sort((a, b) => a.position - b.position);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const template =
    settings?.task_templates?.[job.type]?.length
      ? settings.task_templates[job.type]!
      : DEFAULT_TASK_TEMPLATES[job.type];

  const done = tasks.filter((task) => task.done).length;

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addJobTask(job.id, title);
      setTitle("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-primary" /> Pașii lucrării
        </h3>
        {tasks.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {done} din {tasks.length}
          </span>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {tasks.length > 0 ? (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2.5">
              <Checkbox
                id={`task-${task.id}`}
                checked={task.done}
                onCheckedChange={(value) =>
                  void toggleJobTask(task.id, value === true)
                }
              />
              <label
                htmlFor={`task-${task.id}`}
                className={cn(
                  "flex-1 cursor-pointer py-1.5 text-sm",
                  task.done && "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Șterge ${task.title}`}
                onClick={() => void deleteJobTask(task.id)}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Niciun pas încă. Pune-i pe cei obișnuiți pentru{" "}
          {JOB_TYPE_LABELS[job.type].toLowerCase()} sau scrie-i pe ai tăi.
        </p>
      )}

      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
          placeholder="Adaugă un pas"
          className="h-10 flex-1"
          aria-label="Pas nou"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Adaugă pasul"
          loading={busy}
          onClick={() => void add()}
        >
          <Plus />
        </Button>
      </div>

      {template.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={async () => {
            const added = await applyTaskTemplate(job.id, template);
            toast.success(
              added
                ? `${added} ${added === 1 ? "pas adăugat" : "pași adăugați"}`
                : "Pașii erau deja pe listă",
            );
          }}
        >
          <Wand2 /> Pune pașii pentru {JOB_TYPE_LABELS[job.type].toLowerCase()}
        </Button>
      )}
    </section>
  );
}
