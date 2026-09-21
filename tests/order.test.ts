/**
 * Testele comenzii către furnizor.
 *
 * Cantitatea trimisă la depozit e cantitatea care se plătește. O adunare
 * greșită aici costă bani reali, nu un ecran urât.
 *
 *   node --test tests/order.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_SUPPLIER,
  groupBySupplier,
  orderText,
  whatsappHref,
} from "../src/lib/order.ts";
import type { JobMaterial } from "../src/lib/types.ts";

function material(name: string, quantity: number, unit = "m²"): JobMaterial {
  return { id: `${name}-${quantity}`, name, quantity, unit } as unknown as JobMaterial;
}

test("același material din lucrări diferite se adună într-o linie", () => {
  const orders = groupBySupplier([
    { material: material("Parchet stejar", 20), supplier: "Depozit A" },
    { material: material("Parchet stejar", 22), supplier: "Depozit A" },
    { material: material("Plintă MDF", 30, "m"), supplier: "Depozit A" },
  ]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].lines.length, 2);
  const parchet = orders[0].lines.find((line) => line.name === "Parchet stejar");
  assert.equal(parchet?.quantity, 42);
});

test("același nume în unități diferite rămâne pe linii diferite", () => {
  const orders = groupBySupplier([
    { material: material("Adeziv", 5, "kg"), supplier: "Depozit A" },
    { material: material("Adeziv", 2, "buc"), supplier: "Depozit A" },
  ]);
  assert.equal(orders[0].lines.length, 2);
});

test("furnizorii cunoscuți stau înaintea grămezii fără furnizor", () => {
  const orders = groupBySupplier([
    { material: material("X", 1), supplier: null },
    { material: material("Y", 1), supplier: "Zeta" },
    { material: material("Z", 1), supplier: "Alfa" },
  ]);
  assert.deepEqual(
    orders.map((order) => order.supplier),
    ["Alfa", "Zeta", NO_SUPPLIER],
  );
});

test("textul comenzii se citește ca o comandă", () => {
  const [order] = groupBySupplier([
    { material: material("Parchet stejar", 42), supplier: "Depozit A" },
  ]);
  const text = orderText(order, "Ion Meșter");

  assert.ok(text.startsWith("Comandă — Depozit A"));
  assert.ok(text.includes("• Parchet stejar — 42 m²"));
  assert.ok(text.trimEnd().endsWith("Ion Meșter"));
});

test("fără furnizor, comanda nu-i pune un nume inventat", () => {
  const [order] = groupBySupplier([{ material: material("X", 1), supplier: "  " }]);
  assert.equal(order.supplier, NO_SUPPLIER);
  assert.ok(orderText(order).startsWith("Comandă materiale"));
});

test("linkul de WhatsApp duce textul cu el", () => {
  const withPhone = whatsappHref("Salut", "+373 69 123 456");
  assert.ok(withPhone.startsWith("https://wa.me/37369123456?text="));
  assert.ok(withPhone.includes("Salut"));

  const withoutPhone = whatsappHref("Salut");
  assert.ok(withoutPhone.startsWith("https://wa.me/?text="));
});
