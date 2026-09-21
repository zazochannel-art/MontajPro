"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialDialog } from "@/components/forms/material-dialog";
import { useJobs, useTable } from "@/hooks/use-data";
import { deleteMaterial, toggleJobMaterial } from "@/lib/db/actions";
import { groupBySupplier, orderText, whatsappHref } from "@/lib/order";
import { formatMoney, formatNumber } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import type { Material } from "@/lib/types";
import { sum } from "@/lib/utils";

/** Inventarul propriu + lista de cumpărături generată din lucrări. */
export default function MaterialsPage() {
  const { currency, settings } = useApp();
  const materials = useTable("materials");
  const jobMaterials = useTable("job_materials");
  const jobs = useJobs();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return materials
      .filter(
        (material) =>
          !needle ||
          material.name.toLowerCase().includes(needle) ||
          (material.category ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ro"));
  }, [materials, query]);

  const shoppingList = useMemo(() => {
    const activeJobs = jobs.filter((job) =>
      ["confirmed", "materials", "in_progress"].includes(job.status),
    );
    const jobById = new Map(activeJobs.map((job) => [job.id, job]));
    // Ce mai ai de cumpărat ține cont de depozit: un material pe care îl ai
    // deja pe raft n-are ce căuta pe lista de la magazin.
    const stockById = new Map(materials.map((row) => [row.id, row]));
    return jobMaterials
      .filter((material) => {
        if (material.purchased || material.taken_from_stock) return false;
        if (!jobById.has(material.job_id)) return false;
        const stock = material.material_id
          ? stockById.get(material.material_id)
          : null;
        return !stock || stock.quantity < material.quantity;
      })
      .map((material) => ({
        material,
        job: jobById.get(material.job_id)!,
        inStock: material.material_id
          ? (stockById.get(material.material_id)?.quantity ?? 0)
          : 0,
        // Furnizorul se știe doar prin legătura cu depozitul; un material
        // scris de mână pe o lucrare n-are de unde.
        supplier: material.material_id
          ? (stockById.get(material.material_id)?.supplier ?? null)
          : null,
      }));
  }, [jobMaterials, jobs, materials]);

  const orders = useMemo(() => groupBySupplier(shoppingList), [shoppingList]);

  const stockValue = sum(filtered, (material) => material.quantity * material.price);
  const shoppingTotal = sum(
    shoppingList,
    ({ material }) => material.quantity * material.unit_price,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Materiale"
        description="Stocul tău și ce mai ai de cumpărat"
        action={
          <Button
            className="hidden sm:inline-flex"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> Material nou
          </Button>
        }
      />

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock" className="flex-1">
            Inventar
          </TabsTrigger>
          <TabsTrigger value="shopping" className="flex-1">
            De cumpărat
            {shoppingList.length > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-300">
                {shoppingList.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută material"
              className="pl-10"
            />
          </div>

          {filtered.length ? (
            <>
              <div className="flex items-center justify-between rounded-2xl surface p-3.5">
                <span className="text-sm text-muted-foreground">Valoare stoc</span>
                <span className="font-bold tabular-nums">{formatMoney(stockValue, currency)}</span>
              </div>

              <ul className="space-y-2">
                {filtered.map((material) => (
                  <li
                    key={material.id}
                    className="flex items-center gap-3 rounded-2xl surface p-3.5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Package className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{material.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {material.category ? `${material.category} · ` : ""}
                        {formatNumber(material.quantity)} {material.unit} ·{" "}
                        {formatMoney(material.price, currency)}/{material.unit}
                        {material.supplier && ` · ${material.supplier}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editează"
                        onClick={() => {
                          setEditing(material);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Confirm
                        title="Ștergi materialul?"
                        onConfirm={async () => {
                          await deleteMaterial(material.id);
                          toast.success("Material șters");
                        }}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label="Șterge">
                          <Trash2 className="text-red-400" />
                        </Button>
                      </Confirm>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={query ? "Niciun material găsit" : "Inventar gol"}
              description={
                query
                  ? "Încearcă altă căutare."
                  : "Adaugă materialele folosite des ca să le pui rapid pe lucrări."
              }
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus /> Material nou
                </Button>
              }
            />
          )}

          <Button
            variant="outline"
            className="w-full sm:hidden"
            size="lg"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> Material nou
          </Button>
        </TabsContent>

        <TabsContent value="shopping" className="space-y-3">
          {shoppingList.length ? (
            <>
              <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <span className="flex items-center gap-2 text-sm text-amber-200">
                  <ShoppingCart className="size-4" /> {shoppingList.length} de cumpărat
                </span>
                <span className="font-bold tabular-nums text-amber-200">
                  {formatMoney(shoppingTotal, currency)}
                </span>
              </div>

              {orders.length > 0 && (
                <div className="space-y-2 rounded-2xl surface p-3.5">
                  <p className="text-xs text-muted-foreground">
                    Trimite comanda, grupată pe furnizor:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {orders.map((order) => (
                      <Button
                        key={order.supplier}
                        asChild
                        size="sm"
                        variant="outline"
                      >
                        <a
                          href={whatsappHref(
                            orderText(
                              order,
                              settings?.company || settings?.full_name,
                            ),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Send /> {order.supplier}
                          <span className="text-muted-foreground">
                            ({order.lines.length})
                          </span>
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <ul className="space-y-2">
                {shoppingList.map(({ material, job, inStock }) => (
                  <li
                    key={material.id}
                    className="flex items-center gap-3 rounded-2xl surface p-3.5"
                  >
                    <Checkbox
                      checked={material.purchased}
                      aria-label={`Marchează ${material.name} drept cumpărat`}
                      onCheckedChange={async (checked) => {
                        await toggleJobMaterial(material.id, checked === true);
                        if (checked) toast.success("Bifat ca cumpărat");
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{material.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatNumber(material.quantity)} {material.unit} ·{" "}
                        <Link href={`/lucrari/${job.id}`} className="text-primary hover:underline">
                          {job.title}
                        </Link>
                        {inStock > 0 &&
                          ` · ai ${formatNumber(inStock)} în depozit`}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatMoney(material.quantity * material.unit_price, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="Nimic de cumpărat"
              description="Materialele nebifate de pe lucrările active apar aici."
            />
          )}
        </TabsContent>
      </Tabs>

      <MaterialDialog open={dialogOpen} onOpenChange={setDialogOpen} material={editing} />
    </div>
  );
}
