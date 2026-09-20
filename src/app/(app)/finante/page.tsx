"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/stat-card";
import { FixedCosts } from "@/components/finance/fixed-costs";
import { ExpenseDialog } from "@/components/forms/expense-dialog";
import { PaymentDialog } from "@/components/forms/payment-dialog";
import {
  useJobPaymentIndex,
  useJobs,
  useMinuteTick,
  useTable,
} from "@/hooks/use-data";
import { deleteExpense, deletePayment } from "@/lib/db/actions";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import {
  formatDateShort,
  formatMoney,
  formatNumber,
  monthName,
} from "@/lib/format";
import { fixedCostsForMonth, totalWorkedMinutes } from "@/lib/calc";
import { downloadCsv, expensesCsv, paymentsCsv } from "@/lib/export";
import { useClients } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import type { Expense } from "@/lib/types";

/** Tabloul de bord financiar, pe luni. */
export default function FinancePage() {
  const { currency } = useApp();
  const payments = useTable("payments");
  const expenses = useTable("expenses");
  const sessions = useTable("work_sessions");
  const fixedCosts = useTable("fixed_costs");
  const now = useMinuteTick();
  const jobs = useJobs();
  const paymentIndex = useJobPaymentIndex();
  const clients = useClients();

  const [cursor, setCursor] = useState(() => new Date());
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;

  const data = useMemo(() => {
    const monthPayments = payments
      .filter((payment) => payment.paid_at.slice(0, 7) === monthKey)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    const monthExpenses = expenses
      .filter((expense) => expense.spent_at.slice(0, 7) === monthKey)
      .sort((a, b) => b.spent_at.localeCompare(a.spent_at));

    const income = monthPayments.reduce(
      (acc, payment) => acc + payment.amount,
      0,
    );
    const spent = monthExpenses.reduce(
      (acc, expense) => acc + expense.amount,
      0,
    );
    const advances = monthPayments
      .filter((payment) => payment.kind === "advance")
      .reduce((acc, payment) => acc + payment.amount, 0);

    const receivable = jobs
      .filter((job) => job.status !== "quote")
      .reduce(
        (acc, job) => acc + Math.max(0, paymentIndex[job.id]?.rest ?? 0),
        0,
      );

    const byCategory = monthExpenses.reduce<Record<string, number>>(
      (acc, expense) => {
        acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
        return acc;
      },
      {},
    );

    // Ce a rămas, împărțit la orele de la cronometru: cifra care spune dacă
    // luna a meritat. Fără ore cronometrate n-avem ce arăta.
    const hours =
      totalWorkedMinutes(
        sessions.filter((row) => row.started_at.slice(0, 7) === monthKey),
        now,
      ) / 60;
    // Cheltuielile fixe intră în profitul lunii: fără ele, cifra e mai mare
    // decât adevărul cu exact suma lor.
    const fixed = fixedCostsForMonth(fixedCosts, monthKey);
    const profit = income - spent - fixed;

    return {
      monthPayments,
      monthExpenses,
      income,
      spent,
      fixed,
      profit,
      advances,
      receivable,
      hours,
      perHour: hours >= 0.25 ? profit / hours : null,
      byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
    };
  }, [payments, expenses, sessions, fixedCosts, now, jobs, paymentIndex, monthKey]);

  const jobTitle = (jobId: string | null) =>
    jobId
      ? (jobs.find((job) => job.id === jobId)?.title ?? "Lucrare ștearsă")
      : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finanțe"
        description="Cât intră, cât iese, cât rămâne"
      />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Luna anterioară"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          <ChevronLeft />
        </Button>
        <p className="flex-1 text-center font-semibold capitalize">
          {monthName(cursor.getMonth())} {cursor.getFullYear()}
        </p>
        <Button
          variant="outline"
          size="icon"
          aria-label="Luna următoare"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          <ChevronRight />
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
        <StatCard
          label="Încasări"
          value={formatMoney(data.income, currency, { compact: true })}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Cheltuieli"
          value={formatMoney(data.spent, currency, { compact: true })}
          icon={TrendingDown}
          tone="danger"
        />
        <StatCard
          label="Profit"
          value={formatMoney(data.profit, currency, { compact: true })}
          icon={Wallet}
          tone={data.profit >= 0 ? "success" : "danger"}
          hint={
            data.fixed > 0
              ? `după ${formatMoney(data.fixed, currency, { compact: true })} fixe`
              : undefined
          }
        />
        <StatCard
          label="Bani de primit"
          value={formatMoney(data.receivable, currency, { compact: true })}
          icon={Receipt}
          tone="warning"
          hint="pe toate lucrările"
        />
        <StatCard
          label="Avansuri"
          value={formatMoney(data.advances, currency, { compact: true })}
          icon={Wallet}
          tone="secondary"
        />
        <StatCard
          label="Câștig pe oră"
          value={
            data.perHour === null
              ? "—"
              : formatMoney(data.perHour, currency, { compact: true })
          }
          icon={Clock}
          tone={data.perHour === null ? "default" : "primary"}
          hint={
            data.hours >= 0.25
              ? `${formatNumber(data.hours)} ore cronometrate`
              : "pornește cronometrul pe lucrări"
          }
        />
      </section>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income" className="flex-1">
            Încasări
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1">
            Cheltuieli
          </TabsTrigger>
          <TabsTrigger value="fixed" className="flex-1">
            Fixe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setPaymentOpen(true)}
            >
              <Plus /> Încasare
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={!data.monthPayments.length}
              onClick={() => {
                downloadCsv(
                  `incasari-${monthKey}.csv`,
                  paymentsCsv(
                    data.monthPayments,
                    jobs,
                    (id) =>
                      clients.find((client) => client.id === id)?.name ?? "",
                    currency,
                  ),
                );
                toast.success("Export descărcat");
              }}
            >
              <FileSpreadsheet /> Export CSV
            </Button>
          </div>

          {data.monthPayments.length ? (
            <ul className="space-y-2">
              {data.monthPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                    <TrendingUp className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tabular-nums">
                      {formatMoney(payment.amount, currency)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {PAYMENT_KIND_LABELS[payment.kind]} ·{" "}
                      {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                      {formatDateShort(payment.paid_at)}
                    </p>
                    {payment.job_id && (
                      <Link
                        href={`/lucrari/${payment.job_id}`}
                        className="truncate text-xs text-primary hover:underline"
                      >
                        {jobTitle(payment.job_id)}
                      </Link>
                    )}
                  </div>
                  <Confirm
                    title="Ștergi încasarea?"
                    onConfirm={async () => {
                      await deletePayment(payment.id);
                      toast.success("Încasare ștearsă");
                    }}
                  >
                    <Button variant="ghost" size="icon-sm" aria-label="Șterge">
                      <Trash2 className="text-red-400" />
                    </Button>
                  </Confirm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Wallet}
              title="Nicio încasare luna aceasta"
              description="Plățile adăugate pe lucrări apar automat aici."
            />
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setEditingExpense(null);
                setExpenseOpen(true);
              }}
            >
              <Plus /> Cheltuială
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={!data.monthExpenses.length}
              onClick={() => {
                downloadCsv(
                  `cheltuieli-${monthKey}.csv`,
                  expensesCsv(data.monthExpenses, jobs, currency),
                );
                toast.success("Export descărcat");
              }}
            >
              <FileSpreadsheet /> Export CSV
            </Button>
          </div>

          {data.byCategory.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pe categorii
              </p>
              {data.byCategory.map(([category, amount]) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {EXPENSE_CATEGORY_LABELS[
                        category as keyof typeof EXPENSE_CATEGORY_LABELS
                      ] ?? category}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(amount, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                      style={{
                        width: `${data.spent ? (amount / data.spent) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.monthExpenses.length ? (
            <ul className="space-y-2">
              {data.monthExpenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExpense(expense);
                      setExpenseOpen(true);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
                      <Receipt className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tabular-nums">
                        {formatMoney(expense.amount, currency)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {EXPENSE_CATEGORY_LABELS[expense.category]} ·{" "}
                        {formatDateShort(expense.spent_at)}
                        {expense.note && ` · ${expense.note}`}
                      </span>
                      {expense.job_id && (
                        <span className="block truncate text-xs text-primary">
                          {jobTitle(expense.job_id)}
                        </span>
                      )}
                    </span>
                  </button>
                  <Confirm
                    title="Ștergi cheltuiala?"
                    onConfirm={async () => {
                      await deleteExpense(expense.id);
                      toast.success("Cheltuială ștearsă");
                    }}
                  >
                    <Button variant="ghost" size="icon-sm" aria-label="Șterge">
                      <Trash2 className="text-red-400" />
                    </Button>
                  </Confirm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Receipt}
              title="Nicio cheltuială luna aceasta"
              description="Adaugă combustibil, materiale sau scule — cu poza bonului."
            />
          )}
        </TabsContent>

        <TabsContent value="fixed">
          <FixedCosts monthKey={monthKey} />
        </TabsContent>

      </Tabs>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        jobId={null}
        clientId={null}
      />
      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        expense={editingExpense}
      />
    </div>
  );
}
