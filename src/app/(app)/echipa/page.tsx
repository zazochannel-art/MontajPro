"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  HardHat,
  MapPin,
  Phone,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMinuteTick } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import {
  addSharedPhoto,
  openSharedSession,
  setSharedTask,
  sharedJobs,
  sharedTasks,
  startSharedSession,
  stopSharedSession,
  type OpenSession,
  type SharedJob,
  type SharedTask,
} from "@/lib/team";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDateShort, formatDuration } from "@/lib/format";
import type { JobType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Lucrările la care ești ajutor.
 *
 * Ecranul cere semnal: datele sunt ale altui cont și vin prin funcții din
 * bază, nu prin sincronizarea local-first. Lucrările tale merg offline ca până
 * acum.
 */
export default function TeamJobsPage() {
  const { online } = useApp();
  const [jobs, setJobs] = useState<SharedJob[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void sharedJobs().then((list) => {
      if (!cancelled) setJobs(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Echipă"
        description="Lucrările la care ești ajutor"
      />

      {!online && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-200">
          Ecranul ăsta cere semnal: lucrările sunt ale altui cont și se citesc
          de pe server. Lucrările tale merg mai departe și fără internet.
        </p>
      )}

      {jobs === null ? (
        <Skeleton className="h-48 w-full" />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Nicio lucrare partajată"
          description="Când cineva te pune în echipă și accepți invitația din Setări, lucrările lui apar aici."
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <SharedJobCard
              key={job.id}
              job={job}
              open={openId === job.id}
              onToggle={() => setOpenId(openId === job.id ? null : job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SharedJobCard({
  job,
  open,
  onToggle,
}: {
  job: SharedJob;
  open: boolean;
  onToggle: () => void;
}) {
  const now = useMinuteTick();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<SharedTask[] | null>(null);
  const [session, setSession] = useState<OpenSession | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([sharedTasks(job.id), openSharedSession(job.id)]).then(
      ([list, current]) => {
        if (cancelled) return;
        setTasks(list);
        setSession(current);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, job.id]);

  const minutes = session
    ? Math.max(0, Math.round((now - new Date(session.started_at).getTime()) / 60_000))
    : 0;

  const toggleTask = async (task: SharedTask, done: boolean) => {
    try {
      await setSharedTask(task.id, done);
      setTasks(
        (current) =>
          current?.map((row) => (row.id === task.id ? { ...row, done } : row)) ??
          null,
      );
    } catch {
      toast.error("Bifa n-a ajuns la server — verifică semnalul");
    }
  };

  const toggleTimer = async () => {
    setBusy(true);
    try {
      if (session) {
        await stopSharedSession(session.id);
        setSession(null);
        toast.success("Cronometru oprit");
      } else {
        const id = await startSharedSession(job.id);
        if (!id) {
          toast.error("Lucrarea nu mai e partajată cu tine");
          return;
        }
        setSession({ id, started_at: new Date().toISOString() });
        toast.success("Cronometru pornit");
      }
    } catch {
      toast.error("N-a mers — verifică semnalul");
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = async (file: File) => {
    setBusy(true);
    try {
      await addSharedPhoto(job, file, null);
      toast.success("Poză trimisă");
    } catch {
      toast.error("Poza n-a putut fi trimisă");
    } finally {
      setBusy(false);
    }
  };

  const done = tasks?.filter((task) => task.done).length ?? 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="text-xl">
          {JOB_TYPE_EMOJI[job.type as JobType] ?? "🔧"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{job.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {JOB_TYPE_LABELS[job.type as JobType] ?? job.type}
            {job.scheduled_date ? ` · ${formatDateShort(job.scheduled_date)}` : ""}
            {job.client_name ? ` · ${job.client_name}` : ""}
          </p>
        </div>
        {session && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
            {formatDuration(minutes)}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3.5 border-t border-border p-4">
          <div className="flex flex-wrap gap-2">
            {job.address && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin /> Navighează
                </a>
              </Button>
            )}
            {job.client_phone && (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${job.client_phone}`}>
                  <Phone /> Sună
                </a>
              </Button>
            )}
          </div>

          {job.notes && (
            <p className="whitespace-pre-wrap rounded-xl bg-background p-3 text-sm text-muted-foreground">
              {job.notes}
            </p>
          )}

          {tasks === null ? (
            <Skeleton className="h-24 w-full" />
          ) : tasks.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Pași: {done} din {tasks.length}
              </p>
              <ul className="space-y-1">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5">
                    <Checkbox
                      id={`shared-${task.id}`}
                      checked={task.done}
                      onCheckedChange={(value) =>
                        void toggleTask(task, value === true)
                      }
                    />
                    <label
                      htmlFor={`shared-${task.id}`}
                      className={cn(
                        "flex-1 cursor-pointer py-1.5 text-sm",
                        task.done && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Lucrarea n-are pași puși.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant={session ? "outline" : "default"}
              loading={busy}
              onClick={() => void toggleTimer()}
            >
              {session ? <Square /> : <Play />}
              {session ? "Oprește" : "Start"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void addPhoto(file);
              }}
            />
            <Button
              size="lg"
              variant="outline"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Camera /> Poză
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
