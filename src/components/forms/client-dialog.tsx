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
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { useZodForm } from "@/hooks/use-zod-form";
import { clientSchema } from "@/lib/schemas";
import { saveClient } from "@/lib/db/actions";
import { useClients } from "@/hooks/use-data";
import { findDuplicates } from "@/lib/clients";
import { CLIENT_SOURCE_LABELS } from "@/lib/constants";
import { CLIENT_SOURCES } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, ClientSource } from "@/lib/types";

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
    source: client?.source ?? null,
    referred_by_client_id: client?.referred_by_client_id ?? null,
    price_adjust: client?.price_adjust ?? 0,
  });

  // Cine poate fi „cel care a trimis”: oricine din agendă, în afară de el.
  const referrers = clients.filter(
    (row) => !row.deleted_at && row.id !== client?.id,
  );

  /*
   * Dacă omul e deja în agendă, mai bine îl folosești decât să-l adaugi încă o
   * dată: pe a doua fișă nu se vede nimic din ce ți-a plătit pe prima.
   *
   * Ce se întâmplă la apăsare depinde de unde s-a deschis fereastra, și asta
   * ne-o spune `onSaved`. Dacă cineva așteaptă un client — formularul unei
   * lucrări sau al unei oferte —, îl alegem pe cel găsit și închidem: omul era
   * în mijlocul unei lucrări, iar o plimbare la fișa clientului i-ar arunca la
   * gunoi titlul și prețul pe care tocmai le scrisese. Dacă fereastra s-a
   * deschis singură, din agendă, nu se pierde nimic și îi deschidem fișa.
   */
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
                    if (onSaved) onSaved(match.id);
                    else router.push(`/clienti/${match.id}`);
                  }}
                >
                  {onSaved ? `Alege pe ${match.name}` : `Deschide ${match.name}`}
                </Button>
              ))}
            </div>
          </div>
        )}

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

        <Field
          label="De unde a venit"
          hint="Ca să știi la sfârșit de an cine îți aduce de lucru."
        >
          <Select
            value={form.values.source ?? "none"}
            onValueChange={(value) =>
              form.set("source", value === "none" ? null : (value as ClientSource))
            }
          >
            <SelectTrigger id="client-source">
              <SelectValue placeholder="Nu știu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nu știu</SelectItem>
              {CLIENT_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {CLIENT_SOURCE_LABELS[source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {form.values.source === "recommendation" && referrers.length > 0 && (
          <Field
            label="Recomandat de"
            hint="Omul ăsta merită un telefon de sărbători."
          >
            <Select
              value={form.values.referred_by_client_id ?? "none"}
              onValueChange={(value) =>
                form.set("referred_by_client_id", value === "none" ? null : value)
              }
            >
              <SelectTrigger id="client-referrer">
                <SelectValue placeholder="Nu știu de la cine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nu știu de la cine</SelectItem>
                {referrers.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field
          label="Preț față de lista ta"
          hint="Minus pentru reducere, plus pentru adaos. Se aplică singur în calculator și pe ofertă."
        >
          <NumberInput
            value={form.values.price_adjust ?? 0}
            onChange={(value) => form.set("price_adjust", value)}
            suffix="%"
            step={5}
            min={-99}
            max={100}
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
