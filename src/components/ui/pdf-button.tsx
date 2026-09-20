"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { elementToPdf } from "@/lib/pdf";

/** Salvează documentul cu id-ul dat ca PDF, gata de trimis pe WhatsApp. */
export function PdfButton({
  targetId,
  filename,
}: {
  targetId: string;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={busy}
      onClick={async () => {
        const element = document.getElementById(targetId);
        if (!element) return;
        setBusy(true);
        try {
          await elementToPdf(element, filename);
          toast.success("PDF salvat");
        } catch {
          toast.error("PDF-ul nu a putut fi creat");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown /> PDF
    </Button>
  );
}
