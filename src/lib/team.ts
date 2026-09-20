"use client";

import { getSupabase } from "./supabase/client";
import { stampText, storeImage } from "./storage";

/**
 * Al doilea om.
 *
 * Tot ce vede ajutorul trece prin funcțiile din bază (`shared_*`), nu prin
 * tabele: RLS-ul rămâne „fiecare rând al unui singur cont”, iar banii pur și
 * simplu nu ies din server. De aceea nimic de aici nu intră în sincronizarea
 * local-first — datele sunt ale altui cont, nu ale acestuia.
 *
 * Consecința, spusă pe față: ecranul de lucrări partajate cere semnal. Datele
 * proprii ale ajutorului merg mai departe offline, ca până acum.
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

export async function sharedJobs(): Promise<SharedJob[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("shared_jobs");
  return error ? [] : ((data ?? []) as SharedJob[]);
}

export async function sharedTasks(jobId: string): Promise<SharedTask[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("shared_tasks", { job: jobId });
  return error ? [] : ((data ?? []) as SharedTask[]);
}

export async function setSharedTask(taskId: string, done: boolean) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Fără semnal");
  const { data, error } = await supabase.rpc("shared_task_set", {
    task: taskId,
    value: done,
  });
  if (error || data !== true) throw new Error(error?.message ?? "Refuzat");
}

export interface OpenSession {
  id: string;
  started_at: string;
}

export async function openSharedSession(
  jobId: string,
): Promise<OpenSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("shared_open_session", {
    job: jobId,
  });
  if (error) return null;
  const rows = (data ?? []) as OpenSession[];
  return rows[0] ?? null;
}

export async function startSharedSession(jobId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Fără semnal");
  const { data, error } = await supabase.rpc("shared_session_start", {
    job: jobId,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function stopSharedSession(sessionId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Fără semnal");
  const { error } = await supabase.rpc("shared_session_stop", {
    session_id: sessionId,
  });
  if (error) throw new Error(error.message);
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
