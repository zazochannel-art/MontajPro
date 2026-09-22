/**
 * Testele calendarului exportat.
 *
 * Fișierul ăsta ajunge în agenda telefonului, unde o greșeală nu dă eroare:
 * pur și simplu nu apare nimic, sau apare strâmb.
 *
 *   node --test tests/ics.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs } from "../src/lib/ics.ts";

const NOW = new Date("2026-09-22T06:00:00.000Z");

function lines(ics: string): string[] {
  return ics.split("\r\n");
}

test("fișierul are învelișul cerut de format", () => {
  const ics = buildIcs({ name: "MontCraft", jobs: [], now: NOW });
  const rows = lines(ics);
  assert.equal(rows[0], "BEGIN:VCALENDAR");
  assert.ok(rows.includes("VERSION:2.0"));
  assert.ok(rows.includes("END:VCALENDAR"));
  // Rândurile se despart cu CRLF, nu cu LF.
  assert.ok(ics.includes("\r\n"));
});

test("lucrarea cu oră devine eveniment cu început și sfârșit", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: "Montaj scară", date: "2026-09-22", time: "14:30", hours: 3 }],
    now: NOW,
  });
  assert.ok(ics.includes("DTSTART:20260922T143000"));
  assert.ok(ics.includes("DTEND:20260922T173000"));
  assert.ok(ics.includes("SUMMARY:Montaj scară"));
});

test("lucrarea fără oră ține toată ziua, iar sfârșitul e ziua următoare", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: "Parchet", date: "2026-09-22" }],
    now: NOW,
  });
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260922"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20260923"));
});

test("evenimentul de noapte trece corect în ziua următoare", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: "Tură", date: "2026-09-22", time: "23:00", hours: 3 }],
    now: NOW,
  });
  assert.ok(ics.includes("DTEND:20260923T020000"));
});

test("fără durată, evenimentul nu se întinde peste toată ziua", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: "Măsurătoare", date: "2026-09-22", time: "09:00" }],
    now: NOW,
  });
  assert.ok(ics.includes("DTEND:20260922T110000"), "două ore implicite");
});

test("virgulele și punctul și virgula din titlu se scapă", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: "Scară, parchet; plinte", date: "2026-09-22" }],
    now: NOW,
  });
  assert.ok(ics.includes("SUMMARY:Scară\\, parchet\; plinte"));
});

test("rândul nou din adresă nu rupe fișierul", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: "X", date: "2026-09-22", address: "str. Ismail 45\nap. 3" }],
    now: NOW,
  });
  assert.ok(ics.includes("LOCATION:str. Ismail 45\\nap. 3"));
});

test("rândurile lungi se pliază, iar continuarea începe cu spațiu", () => {
  const long = "Montaj scară stejar masiv cu balustradă din fier forjat și trepte lăcuite";
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [{ id: "j1", title: long, date: "2026-09-22" }],
    now: NOW,
  });
  const rows = lines(ics);
  const encoder = new TextEncoder();
  for (const row of rows) {
    assert.ok(
      encoder.encode(row).length <= 75,
      `rând prea lung (${encoder.encode(row).length} octeți): ${row}`,
    );
  }
  assert.ok(rows.some((row) => row.startsWith(" ")), "trebuia să existe o continuare");
});

test("ziua blocată apare ca eveniment de zi întreagă", () => {
  const ics = buildIcs({
    name: "MontCraft",
    jobs: [],
    blocks: [{ day: "2026-09-24", reason: "Nuntă" }],
    now: NOW,
  });
  assert.ok(ics.includes("SUMMARY:Nuntă"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260924"));
});

test("ziua blocată fără motiv tot are un nume", () => {
  const ics = buildIcs({ name: "M", jobs: [], blocks: [{ day: "2026-09-24" }], now: NOW });
  assert.ok(ics.includes("SUMMARY:Zi blocată"));
});

test("același eveniment păstrează același identificator", () => {
  const make = () =>
    buildIcs({ name: "M", jobs: [{ id: "j1", title: "X", date: "2026-09-22" }], now: NOW });
  const first = make();
  const second = make();
  assert.ok(first.includes("UID:job-j1@montcraft.app"));
  assert.equal(first, second, "la a doua citire trebuie să fie același fișier");
});
