"use client";

import { formatDateShort } from "./format";
import type { Expense, Invoice, Job, Payment } from "./types";

/**
 * Export pentru contabilitate.
 *
 * CSV cu separator `;` și BOM: așa se deschide corect în Excel românesc, unde
 * virgula este separator zecimal, nu de coloane.
 */

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return "﻿" + rows.map((row) => row.map(escapeCell).join(";")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Numerele se scriu cu virgulă zecimală, cum le așteaptă Excel românesc. */
function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2).replace(".", ",");
}

export function paymentsCsv(
  payments: Payment[],
  jobs: Job[],
  clientName: (id: string | null) => string,
  currency: string,
): string {
  const rows: (string | number | null)[][] = [
    ["Data", "Sumă", "Monedă", "Tip", "Metodă", "Lucrare", "Client", "Notă"],
  ];
  for (const payment of [...payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at))) {
    const job = jobs.find((row) => row.id === payment.job_id);
    rows.push([
      formatDateShort(payment.paid_at),
      money(payment.amount),
      currency,
      payment.kind,
      payment.method,
      job?.title ?? "",
      clientName(job?.client_id ?? payment.client_id),
      payment.note ?? "",
    ]);
  }
  return toCsv(rows);
}

export function expensesCsv(
  expenses: Expense[],
  jobs: Job[],
  currency: string,
): string {
  const rows: (string | number | null)[][] = [
    ["Data", "Sumă", "Monedă", "Categorie", "Lucrare", "Notă", "Bon"],
  ];
  for (const expense of [...expenses].sort((a, b) => a.spent_at.localeCompare(b.spent_at))) {
    const job = jobs.find((row) => row.id === expense.job_id);
    rows.push([
      formatDateShort(expense.spent_at),
      money(expense.amount),
      currency,
      expense.category,
      job?.title ?? "",
      expense.note ?? "",
      expense.receipt_path || expense.receipt_local_key ? "da" : "nu",
    ]);
  }
  return toCsv(rows);
}

export function invoicesCsv(invoices: Invoice[], currency: string): string {
  const rows: (string | number | null)[][] = [
    ["Serie", "Număr", "Data", "Scadență", "Client", "Subtotal", "TVA %", "Total", "Monedă", "Achitată"],
  ];
  for (const invoice of [...invoices].sort((a, b) => a.issued_at.localeCompare(b.issued_at))) {
    rows.push([
      invoice.series,
      invoice.number,
      formatDateShort(invoice.issued_at),
      invoice.due_at ? formatDateShort(invoice.due_at) : "",
      invoice.client_name ?? "",
      money(invoice.subtotal),
      money(invoice.vat_percent),
      money(invoice.total),
      currency,
      invoice.paid_at ? formatDateShort(invoice.paid_at) : "nu",
    ]);
  }
  return toCsv(rows);
}
