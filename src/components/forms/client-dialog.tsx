"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { useZodForm } from "@/hooks/use-zod-form";
import { clientSchema } from "@/lib/schemas";
import { saveClient } from "@/lib/db/actions";
import { useClients } from "@/hooks/use-data";
import { findDuplicates } from "@/lib/clients";
import type { Client } from "@/lib/types";

export function ClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ClientForm
          client={client}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Conținutul dialogului este montat abia la deschidere, deci starea pornește
 * de fiecare dată din valorile clientului — fără sincronizări prin efecte.
 */
function ClientForm({
  client,
  onOpenChange,
  onSaved,
}: {
  client?: Client | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const clients = useClients();
  const form = useZodForm(clientSchema, {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    notes: client?.notes ?? "",
  });

  // Dacă omul e deja în agendă, mai bine îl deschizi decât să-l adaugi încă
  // o dată: pe a doua fișă nu se vede nimic din ce ți-a plătit pe prima.
  const duplicates = findDuplicates(clients, {
    name: form.values.name,
    phone: form.values.phone,
    excludeId: client?.id ?? null,
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const saved = await saveClient({ id: client?.id, ...data });
    toast.success(client ? "Client actualizat" : "Client adăugat");
    onOpenChange(false);
    if (saved) onSaved?.(saved.id);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{client ? "Editează clientul" : "Client nou"}</DialogTitle>
        <DialogDescription>
          Numele este suficient ca să începi — restul se poate completa mai
          târziu.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field
          label="Nume"
          htmlFor="client-name"
          error={form.errors.name}
          required
        >
          <Input
            id="client-name"
            autoFocus
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
            placeholder="Ion Popescu"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Telefon"
            htmlFor="client-phone"
            error={form.errors.phone}
          >
            <Input
              id="client-phone"
              type="tel"
              inputMode="tel"
              value={form.values.phone ?? ""}
              onChange={(event) => form.set("phone", event.target.value)}
              placeholder="+373 69 123 456"
            />
          </Field>
          <Field label="Email" htmlFor="client-email" error={form.errors.email}>
            <Input
              id="client-email"
              type="email"
              inputMode="email"
              value={form.values.email ?? ""}
              onChange={(event) => form.set("email", event.target.value)}
              placeholder="ion@exemplu.md"
            />
          </Field>
        </div>

        <Field
          label="Adresă"
          htmlFor="client-address"
          error={form.errors.address}
        >
          <Input
            id="client-address"
            value={form.values.address ?? ""}
            onChange={(event) => form.set("address", event.target.value)}
            placeholder="str. Ismail 45, Chișinău"
          />
        </Field>

        <Field label="Notițe" htmlFor="client-notes">
          <Textarea
            id="client-notes"
            value={form.values.notes ?? ""}
            onChange={(event) => form.set("notes", event.target.value)}
            placeholder="Preferă lucrul în weekend, are câine în curte..."
          />
        </Field>

        {duplicates.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {duplicates[0].by === "phone"
                ? "Numărul ăsta e deja în agendă."
                : "Ai deja un client cu numele ăsta."}
            </p>
            <div className="flex flex-wrap gap-2">
              {duplicates.slice(0, 3).map(({ client: match }) => (
                <Button
                  key={match.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    router.push(`/clienti/${match.id}`);
                  }}
                >
                  Deschide {match.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anulează
          </Button>
          <Button type="submit" loading={form.submitting}>
            {client ? "Salvează" : "Adaugă client"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
