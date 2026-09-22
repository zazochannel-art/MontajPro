/**
 * Cât îi datorezi ajutorului.
 *
 * Aplicația știa de mult cine a lucrat și cât — cronometrul ajutorului scrie
 * `by_member_id` pe sesiune. Dar orele lui nu ajungeau nicăieri în bani.
 *
 * Asta nu era o funcție lipsă, era o cifră greșită: manopera ta nu se scade
 * din profit, și bine face, fiindcă pentru un om pe cont propriu ce rămâne
 * *este* plata muncii lui. Ora ajutorului, însă, e bani care chiar pleacă din
 * buzunar. Lucrarea la care a stat douăzeci de ore îți arăta un profit mai
 * mare decât adevărul, iar pe cifra aia îți făceai prețurile.
 */
import { num } from "./utils";
import type { Expense, WorkSession } from "./types";

export interface CrewLine {
  member_id: string;
  name: string;
  /** Minute lucrate, din sesiunile lui. */
  minutes: number;
  /** Lei pe oră, din setările tale. Zero = n-ai pus încă un tarif. */
  rate: number;
  /** Cât a câștigat: orele × tariful. */
  earned: number;
  /** Cât i-ai dat deja, din cheltuielile legate de el. */
  paid: number;
  /** Cât mai ai de dat. Negativ înseamnă că i-ai dat în avans. */
  owed: number;
}

type Rates = Record<string, number>;

/** Minutele lucrate de fiecare om, pe toate lucrările sau pe una anume. */
function minutesByMember(
  sessions: WorkSession[],
  jobId?: string | null,
): Map<string, { minutes: number; name: string }> {
  const out = new Map<string, { minutes: number; name: string }>();
  for (const session of sessions) {
    if (session.deleted_at) continue;
    // Sesiunile fără `by_member_id` sunt ale tale: munca ta nu se plătește.
    if (!session.by_member_id) continue;
    if (jobId && session.job_id !== jobId) continue;

    const minutes = num(session.duration_minutes);
    if (minutes <= 0) continue;

    const row = out.get(session.by_member_id) ?? {
      minutes: 0,
      name: session.by_member_name ?? "Ajutor",
    };
    row.minutes += minutes;
    // Numele cel mai recent câștigă: omul și-a completat profilul între timp.
    if (session.by_member_name) row.name = session.by_member_name;
    out.set(session.by_member_id, row);
  }
  return out;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Cine cât a lucrat, cât a primit și cât mai are de primit.
 *
 * Cel căruia îi datorezi cel mai mult stă primul: e omul pe care trebuie să-l
 * plătești, nu cel care a muncit cele mai multe ore.
 */
export function crewLedger(
  sessions: WorkSession[],
  expenses: Expense[],
  rates: Rates,
): CrewLine[] {
  const worked = minutesByMember(sessions);

  const paidByMember = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.deleted_at || !expense.member_id) continue;
    paidByMember.set(
      expense.member_id,
      (paidByMember.get(expense.member_id) ?? 0) + num(expense.amount),
    );
  }

  // Și omul plătit fără să aibă ore trebuie să apară: altfel banii dați lui
  // ar dispărea din socoteală.
  const ids = new Set([...worked.keys(), ...paidByMember.keys()]);

  const lines: CrewLine[] = [];
  for (const id of ids) {
    const row = worked.get(id);
    const minutes = row?.minutes ?? 0;
    const rate = num(rates[id]);
    const earned = round2((minutes / 60) * rate);
    const paid = round2(paidByMember.get(id) ?? 0);
    lines.push({
      member_id: id,
      name: row?.name ?? "Ajutor",
      minutes,
      rate,
      earned,
      paid,
      owed: round2(earned - paid),
    });
  }

  return lines.sort((a, b) => b.owed - a.owed);
}

/**
 * Cât te-a costat echipa la o lucrare anume.
 *
 * Cifra asta intră în profitul lucrării. Un om fără tarif pus costă zero — nu
 * ghicim cât îi dai, fiindcă o cifră inventată ar fi mai rea decât una lipsă.
 */
export function crewCostForJob(
  sessions: WorkSession[],
  rates: Rates,
  jobId: string,
): number {
  let total = 0;
  for (const [id, row] of minutesByMember(sessions, jobId)) {
    total += (row.minutes / 60) * num(rates[id]);
  }
  return round2(total);
}

/** Totalul neplătit, pentru un singur rând pe ecranul de bani. */
export function totalOwed(lines: CrewLine[]): number {
  return round2(lines.reduce((acc, line) => acc + Math.max(0, line.owed), 0));
}
