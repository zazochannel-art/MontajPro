"use client";

import { useState } from "react";
import {
  Package,
  PackageCheck,
  PackageMinus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { JobMaterialDialog } from "@/components/forms/job-material-dialog";
import {
  deleteJobMaterial,
  returnToStock,
  takeFromStock,
  toggleJobMaterial,
} from "@/lib/db/actions";
import { useTable } from "@/hooks/use-data";
import { formatMoney, formatNumber } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import type { JobMaterial, Material } from "@/lib/types";
import { sum } from "@/lib/utils";

export function MaterialsTab({
  jobId,
  materials,
}: {
  jobId: string;
  materials: JobMaterial[];
}) {
  const { currency } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobMaterial | null>(null);

  const total = sum(
    materials,
    (material) => material.quantity * material.unit_price,
  );
  const bought = sum(materials, (material) =>
    material.purchased ? material.quantity * material.unit_price : 0,
  );
  const missing = materials.filter((material) => !material.purchased);
  const inventory = useTable("materials");

  return (
    <div className="space-y-3">
      {materials.length ? (
        <>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold tabular-nums">
                {formatMoney(total, currency, { compact: true })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cumpărat</p>
              <p className="font-bold tabular-nums text-emerald-300">
                {formatMoney(bought, currency, { compact: true })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">De cumpărat</p>
              <p className="font-bold tabular-nums text-amber-300">
                {missing.length}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {materials.map((material) => (
              <li
                key={material.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
              >
                <Checkbox
                  checked={material.purchased}
                  aria-label={`Marchează ${material.name} drept cumpărat`}
                  onCheckedChange={(checked) =>
                    void toggleJobMaterial(material.id, checked === true)
                  }
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-medium ${material.purchased ? "text-muted-foreground line-through" : ""}`}
                  >
                    {material.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(material.quantity)} {material.unit}
                    {material.unit_price > 0 &&
                      ` × ${formatMoney(material.unit_price, currency)} = ${formatMoney(
                        material.quantity * material.unit_price,
                        currency,
                      )}`}
                  </p>
                  {material.material_id && (
                    <StockLine material={material} inventory={inventory} />
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editează"
                    onClick={() => {
                      setEditing(material);
                      setOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Confirm
                    title="Ștergi materialul?"
                    onConfirm={async () => {
                      await deleteJobMaterial(material.id);
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

          {missing.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200">
              <ShoppingCart className="size-4 shrink-0" />
              {missing.length} materiale încă necumpărate
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Adaugă material
          </Button>
        </>
      ) : (
        <EmptyState
          icon={Package}
          title="Niciun material"
          description="Adaugă ce ai nevoie pentru lucrare și bifează pe măsură ce cumperi."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Adaugă material
            </Button>
          }
        />
      )}

      <JobMaterialDialog
        open={open}
        onOpenChange={setOpen}
        jobId={jobId}
        material={editing}
      />
    </div>
  );
}

/**
 * Ce e în depozit pentru linia asta, și butonul care îl scoate de acolo.
 *
 * „Cumpărat” și „luat din stoc” sunt două lucruri diferite: una e să dai bani
 * furnizorului, alta e să iei de pe raft ce aveai deja. Doar a doua mișcă
 * inventarul.
 */
function StockLine({
  material,
  inventory,
}: {
  material: JobMaterial;
  inventory: Material[];
}) {
  const stock = inventory.find((row) => row.id === material.material_id);
  if (!stock) return null;

  if (material.taken_from_stock) {
    return (
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline"
        onClick={async () => {
          await returnToStock(material.id);
          toast.success("Material pus la loc în depozit");
        }}
      >
        <PackageCheck className="size-3" /> luat din depozit · pune la loc
      </button>
    );
  }

  return (
    <button
      type="button"
      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      onClick={async () => {
        const result = await takeFromStock(material.id);
        if (!result) return;
        toast.success(
          result.short > 0
            ? `Ai luat tot ce era; lipsesc ${formatNumber(result.short)} ${material.unit}`
            : "Scos din depozit",
        );
      }}
    >
      <PackageMinus className="size-3" />
      în depozit: {formatNumber(stock.quantity)} {stock.unit} · ia din stoc
    </button>
  );
}
