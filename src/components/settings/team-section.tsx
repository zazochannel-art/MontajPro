"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, HardHat, Plus, RotateCcw, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/ui/confirm";
import { useApp } from "@/lib/app-provider";
import {
  acceptInvite,
  inviteMember,
  loadTeam,
  removeMember,
  restoreMember,
  revokeMember,
  type TeamState,
} from "@/lib/team";
import { formatDate } from "@/lib/format";

const EMPTY: TeamState = { members: [], invites: [], memberships: [] };

/**
 * Echipa: pe cine ai lângă tine și la cine ești tu ajutor.
 *
 * Invitația se face pe e-mail, iar accesul se poate retrage oricând. Ajutorul
 * vede lucrarea, pașii, adresa și clientul — niciun preț, nicio plată, nicio
 * cheltuială, nicio ofertă.
 */
export function TeamSection() {
  const { userId, email, mode } = useApp();
  const [team, setTeam] = useState<TeamState>(EMPTY);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [busy, setBusy] = useState(false);
  // Reîncărcarea se cere prin bumparea cheii: starea se pune în callback-ul
  // promisiunii, nu în corpul efectului.
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    void loadTeam(userId ?? null, email ?? null).then((next) => {
      if (!cancelled) setTeam(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, email, reloadKey]);

  if (mode !== "cloud") {
    return (
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <HardHat className="size-4 text-primary" /> Echipă
        </h3>
        <p className="text-xs text-muted-foreground">
          Lucrul cu încă un om cere un cont în cloud: aplicația trebuie să știe
          cui îi dă acces. În mod local nu are ce partaja.
        </p>
      </section>
    );
  }

  const invite = async () => {
    if (!inviteEmail.includes("@")) {
      toast.error("Scrie un e-mail valid");
      return;
    }
    setBusy(true);
    try {
      await inviteMember(inviteEmail, inviteName);
      setInviteEmail("");
      setInviteName("");
      refresh();
      toast.success("Invitație trimisă");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invitația nu a mers",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <HardHat className="size-4 text-primary" /> Echipă
      </h3>
      <p className="text-xs text-muted-foreground">
        Ajutorul vede lucrarea, pașii, adresa și clientul; bifează pași,
        pornește cronometrul și pune poze. Nu vede prețuri, plăți, cheltuieli,
        oferte sau facturi.
      </p>

      {team.invites.length > 0 && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">Ai fost invitat în echipă</p>
          {team.invites.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                invitație din {formatDate(row.invited_at)}
              </span>
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await acceptInvite(row.id);
                  if (!ok) {
                    toast.error("Invitația nu a putut fi acceptată");
                    return;
                  }
                  refresh();
                  toast.success("Ești în echipă");
                }}
              >
                <Check /> Accept
              </Button>
            </div>
          ))}
        </div>
      )}

      {team.memberships.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ești ajutor la {team.memberships.length}{" "}
          {team.memberships.length === 1 ? "persoană" : "persoane"}. Lucrările
          lor sunt în meniul <strong>Echipă</strong>.
        </p>
      )}

      {team.members.length > 0 && (
        <ul className="space-y-2">
          {team.members.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.member_name || row.member_email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.member_name ? row.member_email : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {row.revoked_at ? (
                  <Badge variant="warning">Retras</Badge>
                ) : row.accepted_at ? (
                  <Badge variant="success">Activ</Badge>
                ) : (
                  <Badge>Invitat</Badge>
                )}
                {row.revoked_at ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Redă accesul lui ${row.member_email}`}
                    onClick={async () => {
                      await restoreMember(row.id);
                      refresh();
                    }}
                  >
                    <RotateCcw className="text-muted-foreground" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retrage accesul lui ${row.member_email}`}
                    onClick={async () => {
                      await revokeMember(row.id);
                      refresh();
                      toast.success("Acces retras");
                    }}
                  >
                    <UserMinus className="text-amber-300" />
                  </Button>
                )}
                <Confirm
                  title="Scoți omul din echipă?"
                  description="Dispare din listă. Orele și pozele lui rămân pe lucrări."
                  onConfirm={async () => {
                    await removeMember(row.id);
                    refresh();
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Șterge ${row.member_email}`}
                  >
                    <Trash2 className="text-red-400" />
                  </Button>
                </Confirm>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FieldRow>
        <Field label="E-mailul ajutorului" htmlFor="team-email">
          <Input
            id="team-email"
            type="email"
            inputMode="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="ion@exemplu.md"
          />
        </Field>
        <Field label="Nume" htmlFor="team-name">
          <Input
            id="team-name"
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            placeholder="Ion"
          />
        </Field>
      </FieldRow>
      <Button variant="outline" size="sm" loading={busy} onClick={invite}>
        <Plus /> Invită în echipă
      </Button>
      <p className="text-xs text-muted-foreground">
        Omul intră cu contul lui de MontajPro, pe același e-mail, și acceptă
        invitația din Setări.
      </p>
    </section>
  );
}
