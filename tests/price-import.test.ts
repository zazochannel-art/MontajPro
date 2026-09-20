/**
 * Testele importului de prețuri.
 *
 * Fișierul vine din Excel-ul cuiva, deci trebuie să reziste la ce scrie
 * Excel-ul: punct și virgulă ca separator, zecimale cu virgulă, un antet
 * deasupra și ghilimele în jurul celulelor.
 *
 *   node --test tests/price-import.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parsePriceList, priceListToCsv } from "../src/lib/price-import.ts";

test("citește punct și virgulă, cu antet", () => {
  const { items } = parsePriceList(
    ["Denumire;Unitate;Preț;Tip", "Demontare parchet;m²;45;parchet"].join("\n"),
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Demontare parchet");
  assert.equal(items[0].unit, "m²");
  assert.equal(items[0].price, 45);
  assert.equal(items[0].kind, "parquet");
});

test("merge și cu virgulă, și cu tab", () => {
  const virgula = parsePriceList("Transport,buc,300").items;
  const tab = parsePriceList("Transport\tbuc\t300").items;
  assert.equal(virgula[0].price, 300);
  assert.equal(tab[0].price, 300);
});

test("zecimalele cu virgulă nu se pierd", () => {
  assert.equal(parseAmount("1 350,50"), 1350.5);
  assert.equal(parseAmount("1,350.50"), 1350.5);
  assert.equal(parseAmount("45"), 45);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("preț"), null);
});

test("tipul se recunoaște și fără diacritice", () => {
  const { items } = parsePriceList(
    ["Montaj;buc;10;scari", "Altul;buc;10;plinta", "Terț;buc;10;"].join("\n"),
  );
  assert.equal(items[0].kind, "stairs");
  assert.equal(items[1].kind, "plinth");
  // Fără tip scris, poziția apare peste tot.
  assert.equal(items[2].kind, "any");
});

test("rândurile fără preț nu intră, dar se numără", () => {
  const { items, skipped } = parsePriceList(
    ["Denumire;Unitate;Preț", "Bun;buc;100", "Stricat;buc;", ";buc;50"].join("\n"),
  );
  assert.equal(items.length, 1);
  // antetul, rândul fără preț și cel fără nume
  assert.equal(skipped, 3);
});

test("fișierul dus se poate aduce înapoi", () => {
  const { items } = parsePriceList("Chituit;m;12,5;plinta");
  const round = parsePriceList(priceListToCsv(items)).items;
  assert.equal(round.length, 1);
  assert.equal(round[0].name, "Chituit");
  assert.equal(round[0].unit, "m");
  assert.equal(round[0].price, 12.5);
  assert.equal(round[0].kind, "plinth");
});
