/**
 * Numărul de document care se ciocnește.
 *
 * Numărul următor se ia din ce are telefonul: maximul local plus unu. Două
 * telefoane fără semnal fac amândouă factura #5. Baza are index unic pe
 * (utilizator, serie, număr) tocmai ca să nu existe două facturi cu același
 * număr — deci refuză a doua.
 *
 * Până acum, refuzul o lăsa în coadă și se reîncerca la nesfârșit. Cum
 * trimiterea se face pe tabele întregi, toate facturile din spate rămâneau
 * și ele blocate: o dublură de acum trei luni oprea tot.
 *
 * Aici se recunoaște exact acel refuz, ca să se poată renumerota documentul
 * și trimite mai departe. Orice altă eroare rămâne ce e — nu inventăm o
 * repornire pentru ceva ce n-am înțeles.
 */
import type { TableName } from "./types";

/** Tabelele cu numerotare proprie, și indexul care le păzește. */
const NUMBERED: Partial<Record<TableName, string>> = {
  quotes: "quotes_number_per_user",
  invoices: "invoices_number_per_user",
};

/**
 * Mesajul ăsta e o ciocnire de numere?
 *
 * Postgres spune „duplicate key value violates unique constraint …”, iar
 * numele indexului e singurul lucru care distinge o dublură de număr de
 * oricare altă dublură (un token public, de pildă).
 */
export function isNumberClash(table: TableName, message: string): boolean {
  const index = NUMBERED[table];
  if (!index) return false;
  const text = message.toLowerCase();
  return text.includes("duplicate key") && text.includes(index);
}

/** Tabelele care se pot renumerota, pentru cine are nevoie de listă. */
export function isNumberedTable(table: TableName): boolean {
  return table in NUMBERED;
}
