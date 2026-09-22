/**
 * Testele termenului de valabilitate al ofertei.
 *
 *   node --test tests/expiry.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expiredQuotes, extendedUntil, quoteExpiry } from "../src/lib/expiry.ts";
import type { Quote, QuoteStatus } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

const TODAY = "2026-09-22";

let n = 0;
function quote(
  validUntil: string | null,
  status: QuoteStatus = "sent",
  patch: Partial<Quote> = {},
): Quote {
  n += 1;
  return {
    ...BASE,
    id: `q${n}`,
    number: n,
    client_id: null,
    job_id: null,
    status,
    title: `Oferta ${n}`,
    advance: 0,
    discount: 0,
    valid_until: validUntil,
    notes: null,
    sent_at: "2026-09-05T08:00:00.000Z",
    accepted_at: null,
    public_token: null,
    accepted_by_client_at: null,
    client_signature: null,
    client_signature_image: null,
    viewed_at: null,
    last_viewed_at: null,
    view_count: 0,
    reminder_sent_at: null,
    rejected_reason: null,
    ...patch,
  };
}

test("termenul de azi nu e încă trecut", () => {
  const result = quoteExpiry(quote(TODAY), TODAY);
  assert.equal(result?.days, 0);
  assert.equal(result?.expired, false, "ziua termenului e încă bună — și baza o acceptă");
  assert.equal(result?.soon, true);
});

test("ziua de după termen înseamnă expirată", () => {
  const result = quoteExpiry(quote("2026-09-21"), TODAY);
  assert.equal(result?.days, -1);
  assert.equal(result?.expired, true);
});

test("trei zile rămase se anunță din timp", () => {
  assert.equal(quoteExpiry(quote("2026-09-25"), TODAY)?.soon, true);
  assert.equal(quoteExpiry(quote("2026-09-26"), TODAY)?.soon, false, "patru zile e încă liniște");
});

test("oferta fără termen nu expiră niciodată", () => {
  assert.equal(quoteExpiry(quote(null), TODAY), null);
});

test("ciorna nu expiră: n-a plecat nicăieri", () => {
  assert.equal(quoteExpiry(quote("2026-01-01", "draft"), TODAY), null);
});

test("oferta acceptată nu expiră: s-a terminat cu bine înainte", () => {
  assert.equal(quoteExpiry(quote("2026-01-01", "accepted"), TODAY), null);
});

test("oferta refuzată nu mai are termen de păzit", () => {
  assert.equal(quoteExpiry(quote("2026-01-01", "rejected"), TODAY), null);
});

test("oferta ștearsă nu se numără", () => {
  assert.equal(quoteExpiry(quote("2026-01-01", "sent", { deleted_at: "2026-02-01" }), TODAY), null);
});

test("o dată stricată nu dărâmă socoteala", () => {
  assert.equal(quoteExpiry(quote("nu e o dată"), TODAY), null);
});

test("expirate se dau cele mai vechi întâi", () => {
  const rows = expiredQuotes(
    [quote("2026-09-20"), quote("2026-08-01"), quote("2026-12-01")],
    TODAY,
  );
  assert.deepEqual(
    rows.map((row) => row.valid_until),
    ["2026-08-01", "2026-09-20"],
    "cea din decembrie e încă bună",
  );
});

test("prelungirea se numără de azi, nu de la termenul trecut", () => {
  assert.equal(
    extendedUntil(TODAY, 14),
    "2026-10-06",
    "altfel o ofertă stătută ar primi un termen tot trecut",
  );
});

test("prelungirea merge și peste capătul lunii", () => {
  assert.equal(extendedUntil("2026-12-28", 7), "2027-01-04");
});
