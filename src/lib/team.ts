"use client";

import { getSupabase } from "./supabase/client";
import { metaGet, metaSet } from "./db/idb";
import { stampText, storeImage } from "./storage";

/**
 * Al doilea om.
 *
 * Tot ce vede ajutorul trece prin funcțiile din bază (`shared_*`), nu prin
 * tabele: RLS-ul rămâne „fiecare rând al unui singur cont”, iar banii pur și
 * simplu nu ies din server. De aceea nimic de aici nu intră în sincronizarea
 * local-first — datele sunt ale altui cont, nu ale acestuia.
 *
 * Offline: ce s-a citit ultima dată rămâne în IndexedDB, iar bifele și orele
 * lucrate se pun la coadă și pleacă la primul semnal. Aplicația se folosește
 * pe șantier — ecranul ajutorului n-avea voie să fie singurul care cere
 * internet.
 */

export interface TeamRow {
  id: string;
  owner_id: string;
  member_email: string;
  member_id: string | null;
  member_name: string | null;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface SharedJob {
  id: string;
  owner_id: string;
  title: string;
  type: string;
  status: string;
  address: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  client_name: string | null;
  client_phone: string | null;
}

export interface SharedTask {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TeamState {
  /** Ajutoarele pe care le-am invitat eu. */
  members: TeamRow[];
  /** Invitațiile primite de mine și neacceptate încă. */
  invites: TeamRow[];
  /** Patronii la care sunt ajutor. */
  memberships: TeamRow[];
}

const EMPTY: TeamState = { members: [], invites: [], memberships: [] };

export async function loadTeam(
  userId: string | null,
  email: string | null,
): Promise<TeamState> {
  const supabase = getSupabase();
  if (!supabase || !userId) return EMPTY;

  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return EMPTY;

  const rows = (data ?? []) as TeamRow[];
  const mine = email?.toLowerCase() ?? "";
  return {
    members: rows.filter((row) => row.owner_id === userId),
    invites: rows.filter(
      (row) =>
        row.owner_id !== userId &&
        !row.accepted_at &&
        !row.revoked_at &&
        row.member_email.toLowerCase() === mine,
    ),
    memberships: rows.filter(
      (row) => row.owner_id !== userId && row.accepted_at && !row.revoked_at,
    ),
  };
}

export async function inviteMember(email: string, name: string | null) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Sincronizarea în cloud nu este pornită");
  const { error } = await supabase.from("team_members").insert({
    member_email: email.trim().toLowerCase(),
    member_name: name?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/** Retragerea accesului: rândul rămâne, ca să se vadă cine a fost în echipă. */
export async function revokeMember(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase
    .from("team_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
}

export async function restoreMember(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("team_members").update({ revoked_at: null }).eq("id", id);
}

export async function removeMember(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("team_members").delete().eq("id", id);
}

export async function acceptInvite(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("team_accept", { invite_id: id });
  return !error && data === true;
}

/**
 * Poza pusă de ajutor.
 *
 * Fișierul urcă în folderul patronului — acolo îl lasă politica de Storage —
 * iar rândul se scrie tot pe contul lui, printr-o funcție cu drepturi de
 * definitor. Altfel poza ar rămâne un fișier fără lucrare.
 */
export async function addSharedPhoto(
  job: SharedJob,
  file: File,
  caption: string | null,
) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Fără semnal");
  // Ștampila e pornită implicit: poza ajutorului e tocmai cea care are nevoie
  // de dată, fiindcă patronul n-a fost acolo.
  const asset = await storeImage(file, "jobs", job.owner_id, stampText(true));
  if (!asset.storage_path) throw new Error("Poza n-a putut fi urcată");
  const { error } = await supabase.rpc("shared_photo_add", {
    job: job.id,
    path: asset.storage_path,
    caption,
  });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Offline: ce s-a citit rămâne, ce s-a făcut așteaptă                 */
/* ------------------------------------------------------------------ */

const JOBS_KEY = "team.jobs";
const TASKS_KEY = (jobId: string) => `team.tasks.${jobId}`;
const QUEUE_KEY = "team.queue";

/** O bifă sau o sesiune de lucru care n-a apucat să plece. */
export type QueuedOp =
  | { type: "task"; taskId: string; done: boolean; at: string }
  | { type: "work"; jobId: string; startedAt: string; endedAt: string };

async function readQueue(): Promise<QueuedOp[]> {
  return (await metaGet<QueuedOp[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(queue: QueuedOp[]) {
  await metaSet(QUEUE_KEY, queue);
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Lucrările partajate, din cache.
 *
 * Cache-ul se întoarce imediat, ca omul să vadă ceva; reîmprospătarea vine
 * după, dacă are semnal.
 */
export async function cachedJobs(): Promise<SharedJob[]> {
  return (await metaGet<SharedJob[]>(JOBS_KEY)) ?? [];
}

export async function refreshJobs(): Promise<SharedJob[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("shared_jobs");
  if (error) return null;
  const rows = (data ?? []) as SharedJob[];
  await metaSet(JOBS_KEY, rows);
  return rows;
}

export async function cachedTasks(jobId: string): Promise<SharedTask[]> {
  return (await metaGet<SharedTask[]>(TASKS_KEY(jobId))) ?? [];
}

export async function refreshTasks(
  jobId: string,
): Promise<SharedTask[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("shared_tasks", { job: jobId });
  if (error) return null;
  const rows = (data ?? []) as SharedTask[];
  await metaSet(TASKS_KEY(jobId), rows);
  return rows;
}

/**
 * Bifează pasul, cu sau fără semnal.
 *
 * Cache-ul se schimbă oricum, ca ecranul să nu mintă; dacă serverul n-a
 * confirmat, bifa intră la coadă. O bifă pusă și scoasă de zece ori lasă o
 * singură intrare: contează ultima stare, nu drumul până la ea.
 */
export async function markTask(
  jobId: string,
  taskId: string,
  done: boolean,
): Promise<"sent" | "queued"> {
  const cached = await cachedTasks(jobId);
  await metaSet(
    TASKS_KEY(jobId),
    cached.map((task) => (task.id === taskId ? { ...task, done } : task)),
  );

  const supabase = getSupabase();
  if (supabase && navigator.onLine) {
    const { data, error } = await supabase.rpc("shared_task_set", {
      task: taskId,
      value: done,
    });
    if (!error && data === true) return "sent";
  }

  const queue = await readQueue();
  await writeQueue([
    ...queue.filter((op) => !(op.type === "task" && op.taskId === taskId)),
    { type: "task", taskId, done, at: new Date().toISOString() },
  ]);
  return "queued";
}

const TIMER_KEY = (jobId: string) => `team.timer.${jobId}`;

/**
 * Cronometrul ajutorului merge local.
 *
 * Ora de început stă pe telefon, nu pe server: altfel pornirea ar cere semnal
 * exact în locul unde de obicei nu e. Sesiunea se scrie întreagă la oprire.
 */
export async function startedAt(jobId: string): Promise<string | null> {
  return metaGet<string>(TIMER_KEY(jobId));
}

export async function startTimer(jobId: string): Promise<string> {
  const now = new Date().toISOString();
  await metaSet(TIMER_KEY(jobId), now);
  return now;
}

/**
 * Oprirea: sesiunea pleacă acum, dacă se poate, altfel la primul semnal — cu
 * orele ei adevărate, nu cu cele de la momentul trimiterii.
 */
export async function stopTimer(
  jobId: string,
): Promise<"sent" | "queued" | "none"> {
  const started = await metaGet<string>(TIMER_KEY(jobId));
  if (!started) return "none";
  const ended = new Date().toISOString();
  await metaSet(TIMER_KEY(jobId), null);

  const supabase = getSupabase();
  if (supabase && navigator.onLine) {
    const { data, error } = await supabase.rpc("shared_session_log", {
      job: jobId,
      started,
      ended,
    });
    if (!error && data) return "sent";
  }

  const queue = await readQueue();
  await writeQueue([
    ...queue,
    { type: "work", jobId, startedAt: started, endedAt: ended },
  ]);
  return "queued";
}

/**
 * Golirea cozii.
 *
 * O operație care eșuează rămâne la coadă; una refuzată de server (lucrarea
 * nu mai e partajată) iese, altfel ar bloca coada la nesfârșit.
 */
export async function flushQueue(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase || !navigator.onLine) return 0;

  const queue = await readQueue();
  if (!queue.length) return 0;

  const left: QueuedOp[] = [];
  let sent = 0;

  for (const op of queue) {
    try {
      if (op.type === "task") {
        const { error } = await supabase.rpc("shared_task_set", {
          task: op.taskId,
          value: op.done,
        });
        if (error) left.push(op);
        else sent++;
      } else {
        const { error } = await supabase.rpc("shared_session_log", {
          job: op.jobId,
          started: op.startedAt,
          ended: op.endedAt,
        });
        if (error) left.push(op);
        else sent++;
      }
    } catch {
      left.push(op);
    }
  }

  await writeQueue(left);
  return sent;
}
