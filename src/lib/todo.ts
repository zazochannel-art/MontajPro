/**
 * Tot ce-ți stă nebifat, pe toate lucrările.
 *
 * Checklistul exista de mult, dar îl vedeai doar intrând în lucrare — adică
 * exact atunci când erai deja acolo și îți aminteai singur. Dimineața,
 * întrebarea e alta: ce am de terminat azi, în total?
 *
 * Lucrările terminate și cele arhivate nu mai cer nimic: un pas rămas nebifat
 * pe o lucrare predată e o urmă, nu o sarcină.
 */
import type { Job, JobTask } from "./types";

export interface OpenTask {
  task: JobTask;
  job: Job;
}

export interface JobTodo {
  job: Job;
  tasks: JobTask[];
  /** Câți pași are lucrarea cu totul, ca să se vadă cât ai făcut. */
  total: number;
}

/** Lucrările cu pași nebifați, cu cele programate mai devreme în față. */
export function openTasks(tasks: JobTask[], jobs: Job[]): JobTodo[] {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const grouped = new Map<string, { open: JobTask[]; total: number }>();

  for (const task of tasks) {
    if (task.deleted_at) continue;
    const job = byId.get(task.job_id);
    if (!job || job.deleted_at || job.archived_at || job.status === "done") continue;

    const bucket = grouped.get(job.id) ?? { open: [], total: 0 };
    bucket.total += 1;
    if (!task.done) bucket.open.push(task);
    grouped.set(job.id, bucket);
  }

  const result: JobTodo[] = [];
  for (const [jobId, bucket] of grouped) {
    if (!bucket.open.length) continue;
    const job = byId.get(jobId);
    if (!job) continue;
    result.push({
      job,
      tasks: bucket.open.sort((a, b) => a.position - b.position),
      total: bucket.total,
    });
  }

  /*
   * Ordinea e cea a zilelor: ce e programat mai devreme urcă. Lucrarea fără
   * dată stă la urmă — n-o poți face „azi” dacă n-ai hotărât încă pe când e.
   */
  return result.sort((a, b) => {
    const dateA = a.job.scheduled_date ?? "9999-12-31";
    const dateB = b.job.scheduled_date ?? "9999-12-31";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.job.title.localeCompare(b.job.title, "ro");
  });
}

/** Câți pași nebifați ai cu totul. */
export function openCount(todos: JobTodo[]): number {
  return todos.reduce((acc, todo) => acc + todo.tasks.length, 0);
}
