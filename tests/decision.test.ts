/**
 * Testele ritmului de hotărâre.
 *
 *   node --test tests/decision.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_DAYS,
  MIN_QUOTES,
  decisionPace,
  lateAfterDays,
} from "../src/lib/decision.ts";
import type { Quote } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-01T08:00:00.000Z",
  updated_at: "2026-01-01T08:00:00.000Z",
  deleted_at: null,
};

/** O ofertă trimisă la `sent` și acceptată după `days` zile. */
function quote(id: string, sent: string | null, days: number | null): Quote {
  const accepted =
    sent && days !== null
      ? new Date(Date.parse(sent) + days * 86_400_000).toISOString()
      : null;
  return {
    ...BASE,
    id,
    number: 1,
    client_id: null,
    job_id: null,
    status: accepted ? "accepted" : "sent",
    title: id,
    advance: 0,
    discount: 0,
    valid_until: null,
    notes: null,
    sent_at: sent,
    accepted_at: accepted,
    public_token: null,
    accepted_by_client_at: null,
    client_signature: null,
    client_signature_image: null,
    viewed_at: null,
    last_viewed_at: null,
    view_count: 0,
    reminder_sent_at: null,
    rejected_reason: null,
  } as Quote;
}

const SENT = "2026-09-01T08:00:00.000Z";

test("sub pragul de oferte nu se dă niciun număr", () => {
  const few = Array.from({ length: MIN_QUOTES - 1 }, (_, i) =>
    quote(`q${i}`, SENT, 5),
  );
  assert.equal(decisionPace(few), null);
});

test("mediana se ia din ofertele câștigate", () => {
  const pace = decisionPace([
    quote("a", SENT, 2),
    quote("b", SENT, 4),
    quote("c", SENT, 6),
    quote("d", SENT, 8),
  ]);
  assert.equal(pace?.median, 5, "media celor două din mijloc");
  assert.equal(pace?.quotes, 4);
});

test("un client care a tăcut trei luni nu mută cifra", () => {
  const pace = decisionPace([
    quote("a", SENT, 3),
    quote("b", SENT, 4),
    quote("c", SENT, 5),
    quote("d", SENT, 6),
    quote("lent", SENT, 90),
  ]);
  assert.equal(pace?.median, 5, "mediana rămâne la mijloc, oricât de lung e capătul");
});

test("oferta netrimisă nu intră în socoteală", () => {
  const pace = decisionPace([
    quote("a", SENT, 2),
    quote("b", SENT, 4),
    quote("c", SENT, 6),
    quote("d", SENT, 8),
    quote("fara-trimitere", null, 3),
  ]);
  assert.equal(pace?.quotes, 4);
});

test("oferta încă neacceptată nu intră", () => {
  const pace = decisionPace([
    quote("a", SENT, 2),
    quote("b", SENT, 4),
    quote("c", SENT, 6),
    quote("d", SENT, 8),
    quote("in-asteptare", SENT, null),
  ]);
  assert.equal(pace?.quotes, 4);
});

test("acceptarea dinaintea trimiterii e o dată stricată, nu o zi negativă", () => {
  const stricata = quote("stricata", SENT, 0);
  stricata.accepted_at = "2026-08-01T08:00:00.000Z";
  const pace = decisionPace([
    quote("a", SENT, 2),
    quote("b", SENT, 4),
    quote("c", SENT, 6),
    quote("d", SENT, 8),
    stricata,
  ]);
  assert.equal(pace?.quotes, 4);
});

test("semnătura clientului contează înaintea acceptării manuale", () => {
  const semnata = quote("semnata", SENT, 20);
  semnata.accepted_by_client_at = new Date(
    Date.parse(SENT) + 2 * 86_400_000,
  ).toISOString();
  const pace = decisionPace([semnata, ...["a", "b", "c"].map((id) => quote(id, SENT, 2))]);
  assert.equal(pace?.median, 2, "ziua în care a semnat omul, nu ziua în care ai bifat tu");
});

test("oferta ștearsă nu se numără", () => {
  const stearsa = { ...quote("stearsa", SENT, 1), deleted_at: "2026-09-05T00:00:00.000Z" };
  const pace = decisionPace([
    quote("a", SENT, 4),
    quote("b", SENT, 4),
    quote("c", SENT, 4),
    quote("d", SENT, 4),
    stearsa,
  ]);
  assert.equal(pace?.quotes, 4);
  assert.equal(pace?.median, 4);
});

test("fără istoric se rămâne la trei zile", () => {
  assert.equal(lateAfterDays(null), FALLBACK_DAYS);
});

test("cu istoric, întârzierea se măsoară cu o zi peste mediană", () => {
  assert.equal(lateAfterDays({ median: 6, quotes: 9 }), 7);
  assert.equal(lateAfterDays({ median: 5.5, quotes: 9 }), 7, "se rotunjește în sus");
});

test("clienții iuți nu scurtează pragul sub trei zile", () => {
  assert.equal(lateAfterDays({ median: 0.5, quotes: 9 }), FALLBACK_DAYS);
});
