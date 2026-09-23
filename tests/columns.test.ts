/**
 * Lista de coloane trimise spre server, pusă lângă baza de date adevărată.
 *
 * `TABLE_COLUMNS` e singurul filtru la trimitere, iar `toPayload` pune în
 * payload **fiecare** coloană din listă. PostgREST refuză tot lotul dacă
 * una dintre ele nu există în tabel — nu doar rândul, lotul întreg, de
 * fiecare dată, la nesfârșit.
 *
 * Așa au stat facturile pe loc trei zile: `tax_percent` și `language` erau
 * pe `settings`, dar fuseseră copiate și la `invoices`, unde nu există.
 * Nimic nu se plângea — nici typecheck-ul, nici testele, nici serverul fals
 * din `fake-postgrest.mjs`, care primește orice coloană.
 *
 * `schema.json` e o poză a bazei reale. Se reface cu:
 *
 *   select table_name, string_agg(column_name, ',' order by column_name)
 *   from information_schema.columns
 *   where table_schema = 'public' group by table_name order by table_name;
 *
 * O coloană nouă adăugată aici fără migrație pică testul, nu sincronizarea.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TABLE_COLUMNS, toPayload } from "../src/lib/db/columns.ts";
import { TABLE_NAMES } from "../src/lib/types.ts";

const schema: Record<string, string[]> = JSON.parse(
  readFileSync(new URL("./schema.json", import.meta.url), "utf8"),
);

test("fiecare coloană trimisă există în baza de date", () => {
  const missing: string[] = [];
  for (const table of TABLE_NAMES) {
    const real = schema[table];
    assert.ok(real, `tabelul ${table} lipsește din poza schemei`);
    for (const column of TABLE_COLUMNS[table]) {
      if (!real.includes(column)) missing.push(`${table}.${column}`);
    }
  }
  assert.deepEqual(missing, [], `coloane inexistente în baza de date: ${missing.join(", ")}`);
});

test("payload-ul unei facturi nu cere coloane care nu există", () => {
  const payload = toPayload("invoices", { id: "x", number: 5, series: "MC" });
  for (const column of Object.keys(payload)) {
    assert.ok(
      schema.invoices.includes(column),
      `invoices nu are coloana ${column}`,
    );
  }
});

test("poza schemei acoperă toate tabelele sincronizate", () => {
  for (const table of TABLE_NAMES) {
    assert.ok(table in schema, `${table} lipsește din schema.json`);
  }
});
