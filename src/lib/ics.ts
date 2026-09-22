/**
 * Calendarul tău, în calendarul telefonului.
 *
 * Aplicația are un calendar, dar el trăiește doar înăuntrul ei. Cine vrea să
 * știe când ești liber — tu de pe alt telefon, soția, un coleg — trebuie să te
 * întrebe. Un fișier `.ics` la care te abonezi o dată rezolvă asta pentru
 * totdeauna: lucrările apar în agenda telefonului, alături de restul vieții.
 *
 * Formatul e RFC 5545. Trei lucruri se greșesc de obicei și le facem cu grijă:
 * caracterele speciale se scapă, rândurile lungi se pliază la 75 de octeți, iar
 * ziua întreagă se scrie cu `VALUE=DATE` și cu sfârșitul în ziua următoare.
 */

export interface IcsJob {
  id: string;
  title: string;
  address?: string | null;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** HH:mm. Gol = eveniment pe toată ziua. */
  time?: string | null;
  hours?: number | null;
}

export interface IcsBlock {
  day: string;
  reason?: string | null;
}

/** Virgula, punctul și virgula, bara oblică și rândul nou au înțeles în format. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Rândurile mai lungi de 75 de octeți se rup, iar continuarea începe cu un
 * spațiu. Numărăm octeți, nu caractere: „ă” ocupă doi, iar un rând tăiat greșit
 * strică fișierul.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Primul rând are 75, continuările 74, fiindcă încep cu un spațiu.
    const limit = out.length ? 74 : 75;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current) out.push(current);
  return out.join("\r\n ");
}

function stampNow(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** `2026-09-22` → `20260922`. */
function dateValue(day: string): string {
  return day.replace(/-/g, "");
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return dateValue(date.toISOString().slice(0, 10));
}

/** `2026-09-22` + `14:30` → `20260922T143000`, în ora locală a telefonului. */
function localStamp(day: string, time: string): string {
  return `${dateValue(day)}T${time.replace(":", "")}00`;
}

function addHours(day: string, time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const date = new Date(`${day}T00:00:00`);
  date.setHours(h, m + Math.round(hours * 60), 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
}

/**
 * Calendarul întreg, ca text.
 *
 * `domain` intră în identificatorul fiecărui eveniment, ca telefonul să știe
 * că e vorba de același eveniment la următoarea reîmprospătare, nu de unul nou.
 */
export function buildIcs(input: {
  name: string;
  jobs: IcsJob[];
  blocks?: IcsBlock[];
  domain?: string;
  now?: Date;
}): string {
  const domain = input.domain ?? "montcraft.app";
  const stamp = stampNow(input.now ?? new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MontCraft//Calendar//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.name)}`,
  ];

  for (const job of input.jobs) {
    if (!job.date) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:job-${job.id}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);

    if (job.time) {
      lines.push(`DTSTART:${localStamp(job.date, job.time)}`);
      // Fără durată estimată, punem două ore: un eveniment fără sfârșit
      // acoperă toată ziua în unele agende.
      lines.push(`DTEND:${addHours(job.date, job.time, job.hours || 2)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateValue(job.date)}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(job.date)}`);
    }

    lines.push(`SUMMARY:${escapeText(job.title)}`);
    if (job.address) lines.push(`LOCATION:${escapeText(job.address)}`);
    lines.push("END:VEVENT");
  }

  for (const block of input.blocks ?? []) {
    if (!block.day) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:block-${block.day}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dateValue(block.day)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(block.day)}`);
    lines.push(`SUMMARY:${escapeText(block.reason || "Zi blocată")}`);
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
