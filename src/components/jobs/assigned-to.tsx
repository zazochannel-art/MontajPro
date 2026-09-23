"use client";

import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { useApp } from "@/lib/app-provider";
import { loadTeam, type TeamRow } from "@/lib/team";
import type { Job } from "@/lib/types";

/**
 * Cine merge la lucrarea asta.
 *
 * Orele lucrate spuneau cine a fost, după fapt. Cu doi-trei oameni,
 * întrebarea de dimineață e alta: cine merge la Ismail? Apare doar când
 * chiar e trimis altcineva — „Eu” nu e o informație.
 */
export function AssignedTo({ job }: { job: Job }) {
  const { userId, email } = useApp();
  const [team, setTeam] = useState<TeamRow[]>([]);

  useEffect(() => {
    if (!job.assigned_member_id) return;
    let cancelled = false;
    void loadTeam(userId, email).then((state) => {
      if (!cancelled) setTeam(state.members);
    });
    return () => {
      cancelled = true;
    };
  }, [job.assigned_member_id, userId, email]);

  if (!job.assigned_member_id) return null;

  const row = team.find((item) => item.member_id === job.assigned_member_id);
  const name = row?.member_name || row?.member_email;

  return (
    <p className="flex items-center gap-2 rounded-2xl surface p-3.5 text-sm">
      <HardHat className="size-4 shrink-0 text-primary" />
      <span>
        Merge <strong>{name ?? "cineva din echipă"}</strong>
        {!name && " — omul nu mai e în echipă"}
      </span>
    </p>
  );
}
