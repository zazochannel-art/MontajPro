/**
 * Testele numărului de document care se ciocnește.
 *
 *   node --test tests/renumber.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isNumberClash, isNumberedTable } from "../src/lib/renumber.ts";

const CLASH =
  'duplicate key value violates unique constraint "invoices_number_per_user"';

test("dublura de număr de factură se recunoaște", () => {
  assert.equal(isNumberClash("invoices", CLASH), true);
});

test("și cea de ofertă", () => {
  assert.equal(
    isNumberClash(
      "quotes",
      'duplicate key value violates unique constraint "quotes_number_per_user"',
    ),
    true,
  );
});

test("dublura de token public nu e o ciocnire de numere", () => {
  assert.equal(
    isNumberClash(
      "quotes",
      'duplicate key value violates unique constraint "quotes_public_token_key"',
    ),
    false,
    "altfel am renumerota o ofertă pentru o cu totul altă problemă",
  );
});

test("altă eroare rămâne ce e", () => {
  assert.equal(isNumberClash("invoices", "network error"), false);
  assert.equal(
    isNumberClash("invoices", 'null value in column "total" violates not-null'),
    false,
  );
});

test("un tabel fără numerotare proprie nu se renumerotează niciodată", () => {
  assert.equal(isNumberClash("jobs", CLASH), false);
  assert.equal(isNumberedTable("jobs"), false);
  assert.equal(isNumberedTable("invoices"), true);
});

test("majusculele din mesajul serverului nu încurcă", () => {
  assert.equal(isNumberClash("invoices", CLASH.toUpperCase()), true);
});
