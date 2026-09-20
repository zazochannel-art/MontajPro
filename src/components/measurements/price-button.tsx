"use client";

import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { measurementToSeed } from "@/lib/calc";
import { saveCalcSeed } from "@/lib/calc-draft";
import type { JobMeasurement } from "@/lib/types";

/**
 * Din măsurătoare direct în preț.
 *
 * Cifrele sunt deja calculate — numărul de trepte, metrii pătrați, metrii
 * liniari. Fără butonul ăsta, omul le retasta în calculator.
 */
export function PriceFromMeasurement({
  measurement,
  className,
}: {
  measurement: JobMeasurement;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        saveCalcSeed(
          measurementToSeed(
            measurement.kind,
            measurement.data,
            measurement.label || undefined,
          ),
        );
        router.push("/calculator");
      }}
    >
      <Calculator /> Fă prețul
    </Button>
  );
}
