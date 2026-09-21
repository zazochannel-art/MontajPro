"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZodForm } from "@/hooks/use-zod-form";
import { useClients } from "@/hooks/use-data";
import { projectSchema } from "@/lib/schemas";
import { saveProject } from "@/lib/db/actions";
import type { Project } from "@/lib/types";

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ProjectForm
          project={project}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Montat abia la deschidere, deci pornește mereu din valorile proiectului. */
function ProjectForm({
  project,
  onOpenChange,
  onSaved,
}: {
  project?: Project | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const clients = useClients();
  const form = useZodForm(projectSchema, {
    name: project?.name ?? "",
    client_id: project?.client_id ?? null,
    address: project?.address ?? "",
    notes: project?.notes ?? "",
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const saved = await saveProject({ id: project?.id, ...data });
    toast.success(project ? "Proiect actualizat" : "Proiect creat");
    onOpenChange(false);
    if (saved) onSaved?.(saved.id);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {project ? "Editează proiectul" : "Proiect nou"}
        </DialogTitle>
        <DialogDescription>
          Un bloc, o scară, o casă cu mai multe etaje — locul sub care pui
          lucrările care merg împreună.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field
          label="Nume"
          htmlFor="project-name"
          error={form.errors.name}
          required
        >
          <Input
            id="project-name"
            autoFocus
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
            placeholder="Bloc Ismail 45, scara 2"
          />
        </Field>

        <Field label="Client" htmlFor="project-client">
          <Select
            value={form.values.client_id ?? "none"}
            onValueChange={(value) =>
              form.set("client_id", value === "none" ? null : value)
            }
          >
            <SelectTrigger id="project-client">
              <SelectValue placeholder="Alege clientul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Fără client</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Adresă" htmlFor="project-address">
          <Input
            id="project-address"
            value={form.values.address ?? ""}
            onChange={(event) => form.set("address", event.target.value)}
            placeholder="str. Ismail 45, Chișinău"
          />
        </Field>

        <Field label="Notițe" htmlFor="project-notes">
          <Textarea
            id="project-notes"
            rows={3}
            value={form.values.notes ?? ""}
            onChange={(event) => form.set("notes", event.target.value)}
            placeholder="Cu cine vorbești, unde se parchează, când se poate lucra..."
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Renunță
          </Button>
          <Button type="submit" disabled={form.submitting}>
            {project ? "Salvează" : "Creează proiectul"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
