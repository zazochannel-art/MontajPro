"use client";

import {
  JOB_STATUS_CLASSES,
  JOB_STATUS_DOT,
  JOB_STATUS_LABELS,
} from "@/lib/constants";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/use-t";

export function StatusBadge({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        JOB_STATUS_CLASSES[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", JOB_STATUS_DOT[status])} />
      {t(JOB_STATUS_LABELS[status])}
    </span>
  );
}
