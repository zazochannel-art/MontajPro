"use client";

import { useRef, useState } from "react";
import {
  Archive,
  Bell,
  HardHat,
  Building2,
  Camera,
  ListChecks,
  Coins,
  Download,
  FlaskConical,
  LogOut,
  RefreshCw,
  Ruler,
  Share,
  Smartphone,
  Plus,
  Tags,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Confirm } from "@/components/ui/confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { archiveOldJobs, updateSettings } from "@/lib/db/actions";
import { hasDemoData, removeDemoData, seedDemoData } from "@/lib/db/demo";
import { BackupSection } from "@/components/settings/backup-section";
import { ConflictsSection } from "@/components/settings/conflicts-section";
import { PushToggle } from "@/components/settings/push-toggle";
import { TeamSection } from "@/components/settings/team-section";
import { useArchivedJobs, useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import {
  CURRENCIES,
  DEFAULT_MATERIAL_CATEGORIES,
  DEFAULT_TASK_TEMPLATES,
  JOB_TYPE_LABELS,
} from "@/lib/constants";
import { JOB_TYPES } from "@/lib/types";
import { parsePriceList, priceListToCsv } from "@/lib/price-import";
import { downloadCsv } from "@/lib/export";
import { BUILTIN_POSITIONS } from "@/lib/price-list";
import type { NotificationPrefs, PriceItem } from "@/lib/types";
import { uid } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

const NOTIFICATION_LABELS: Record<keyof NotificationPrefs, string> = {
  job_today: "Lucrare azi",
  job_tomorrow: "Lucrare mâine",
  payment_due: "Plată restantă",
  tool_warranty: "Garanție sculă",
  materials_missing: "Materiale lipsă",
  quote_pending: "Ofertă neconfirmată",
  installment_due: "Tranșă scadentă",
  follow_up: "Revino la client",
  job_warranty: "Garanția lucrării",
  quote_viewed: "Clientul a deschis oferta",
};

export default function SettingsPage() {
  const {
    settings,
    currency,
    mode,
    email,
    signOut,
    sync,
    lastSyncAt,
    pendingChanges,
    siteMode,
    setSiteMode,
  } = useApp();
  const { canInstall, installed, isIOS, install } = useInstallPrompt();
  const priceFileRef = useRef<HTMLInputElement>(null);
  const [newCategory, setNewCategory] = useState("");
  const [archiveMonths, setArchiveMonths] = useState("12");
  const archived = useArchivedJobs();
  // Recitim la fiecare schimbare de date, ca butonul demo să fie corect.
  useTable("clients");
  const demoLoaded = hasDemoData();

  if (!settings) {
    return (
      <p className="text-sm text-muted-foreground">Se încarcă setările…</p>
    );
  }

  const rates = settings.default_rates;
  const priceList = settings.price_list ?? [];
  const templates = settings.task_templates ?? {};
  const prefs = settings.notification_prefs;

  /** O poziție se scrie înapoi întreagă: lista e un singur câmp în setări. */
  const savePosition = (id: string, patch: Partial<PriceItem>) =>
    void updateSettings({
      price_list: priceList.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });

  /**
   * Pozițiile aduse dintr-un fișier se adaugă peste cele existente; cele cu
   * același nume se sar, ca un import repetat să nu dubleze lista.
   */
  const importPrices = async (file: File) => {
    try {
      const { items, skipped } = parsePriceList(await file.text());
      if (!items.length) {
        toast.error("Niciun rând de preț recunoscut în fișier");
        return;
      }
      const known = new Set(
        priceList.map((item) => item.name.trim().toLowerCase()),
      );
      const fresh = items.filter((item) => {
        const key = item.name.trim().toLowerCase();
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
      await updateSettings({ price_list: [...priceList, ...fresh] });
      toast.success(
        `${fresh.length} ${fresh.length === 1 ? "poziție adăugată" : "poziții adăugate"}` +
          (items.length - fresh.length + skipped > 0
            ? ` · ${items.length - fresh.length + skipped} rânduri sărite`
            : ""),
      );
    } catch {
      toast.error("Fișierul nu a putut fi citit");
    }
  };

  const addPosition = () =>
    void updateSettings({
      price_list: [
        ...priceList,
        { id: uid(), name: "", unit: "buc", price: 0, kind: "any" as const },
      ],
    });

  const categories = settings.material_categories?.length
    ? settings.material_categories
    : DEFAULT_MATERIAL_CATEGORIES;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Setări"
        description="Profil, monedă, tarife și backup"
      />

      <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <User className="size-4 text-primary" /> Profil
        </h3>
        <Field label="Nume">
          <Input
            defaultValue={settings.full_name ?? ""}
            onBlur={(event) =>
              void updateSettings({ full_name: event.target.value || null })
            }
            placeholder="Ion Popescu"
          />
        </Field>
        <FieldRow>
          <Field label="Telefon">
            <Input
              type="tel"
              defaultValue={settings.phone ?? ""}
              onBlur={(event) =>
                void updateSettings({ phone: event.target.value || null })
              }
              placeholder="+373 69 123 456"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              defaultValue={settings.email ?? email ?? ""}
              onBlur={(event) =>
                void updateSettings({ email: event.target.value || null })
              }
            />
          </Field>
        </FieldRow>
        <Field label="Firmă / brand" hint="Apare pe oferte">
          <Input
            defaultValue={settings.company ?? ""}
            onBlur={(event) =>
              void updateSettings({ company: event.target.value || null })
            }
            placeholder="MontajPro SRL"
          />
        </Field>
      </section>

      <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="size-4 text-primary" /> Monedă și unități
        </h3>
        <FieldRow>
          <Field label="Monedă">
            <Select
              value={settings.currency}
              onValueChange={(value) => {
                void updateSettings({ currency: value });
                toast.success(`Monedă: ${value}`);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unități">
            <Select
              value={settings.units}
              onValueChange={(value) =>
                void updateSettings({ units: value as "metric" | "imperial" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Metric (m, m², cm)</SelectItem>
                <SelectItem value="imperial">Imperial (ft, in)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="TVA" hint="0 dacă nu lucrezi cu TVA">
            <NumberInput
              value={settings.vat_percent}
              onChange={(value) => void updateSettings({ vat_percent: value })}
              suffix="%"
              step={1}
            />
          </Field>
          <Field
            label="Impozit"
            hint="Cât pui deoparte din fiecare încasare"
          >
            <NumberInput
              value={settings.tax_percent}
              onChange={(value) => void updateSettings({ tax_percent: value })}
              suffix="%"
              step={1}
            />
          </Field>
        </FieldRow>
      </section>

      <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="size-4 text-primary" /> Tarife implicite
        </h3>
        <p className="text-xs text-muted-foreground">
          Sunt pozițiile din care alegi în calculatorul de preț: alegi poziția,
          prețul vine de aici.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {BUILTIN_POSITIONS.map((position) => (
            <Field
              key={position.key}
              label={position.name}
              htmlFor={`rate-${position.key}`}
              hint={`per ${position.unit}`}
            >
              <MoneyInput
                id={`rate-${position.key}`}
                value={rates[position.key]}
                currency={currency}
                onChange={(value) =>
                  void updateSettings({
                    default_rates: { ...rates, [position.key]: value },
                  })
                }
              />
            </Field>
          ))}
        </div>

        <div className="space-y-2.5 border-t border-border pt-3.5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Poziții proprii
          </h4>
          {priceList.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Adaugă ce mai faci în afara celor de mai sus — demontare, transport,
              pregătit stratul suport — ca să le poți alege direct în calculator.
            </p>
          )}

          {priceList.map((item) => (
            <div
              key={item.id}
              className="space-y-2 rounded-xl border border-border bg-background p-2.5"
            >
              <div className="flex items-center gap-2">
                <Input
                  defaultValue={item.name}
                  placeholder="Demontare parchet vechi"
                  className="h-10 flex-1"
                  onBlur={(event) => savePosition(item.id, { name: event.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Șterge ${item.name || "poziția"}`}
                  onClick={() =>
                    void updateSettings({
                      price_list: priceList.filter((other) => other.id !== item.id),
                    })
                  }
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Unitate">
                  <Input
                    defaultValue={item.unit}
                    placeholder="buc"
                    onBlur={(event) =>
                      savePosition(item.id, { unit: event.target.value || "buc" })
                    }
                  />
                </Field>
                <Field label="Apare la">
                  <Select
                    value={item.kind}
                    onValueChange={(value) =>
                      savePosition(item.id, { kind: value as PriceItem["kind"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stairs">Scări</SelectItem>
                      <SelectItem value="parquet">Parchet</SelectItem>
                      <SelectItem value="plinth">Plintă</SelectItem>
                      <SelectItem value="any">Oriunde</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Preț">
                  <MoneyInput
                    value={item.price}
                    currency={currency}
                    onChange={(value) => savePosition(item.id, { price: value })}
                  />
                </Field>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={addPosition}>
              <Plus /> Adaugă poziție
            </Button>
            <input
              ref={priceFileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importPrices(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => priceFileRef.current?.click()}
            >
              <Upload /> Importă din fișier
            </Button>
            {priceList.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv("montajpro-preturi.csv", priceListToCsv(priceList))
                }
              >
                <Download /> Exportă
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Fișierul are pe fiecare rând: denumire; unitate; preț; tip. Merge și
            cu virgulă sau tab ca separator, și cu zecimale cu virgulă.
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="size-4 text-primary" /> Fotografii
        </h3>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">Pune data pe poze</p>
            <p className="text-xs text-muted-foreground">
              O poză „înainte” fără dată nu ține loc de dovadă.
            </p>
          </div>
          <Switch
            checked={settings.photo_stamp !== false}
            onCheckedChange={(checked) =>
              void updateSettings({ photo_stamp: checked })
            }
          />
        </div>
      </section>

      <TeamSection />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-primary" /> Pașii lucrării
        </h3>
        <p className="text-xs text-muted-foreground">
          Câte un pas pe rând. Îi pui pe o lucrare dintr-o apăsare, iar de acolo
          sunt ai ei — un șablon schimbat mai târziu nu rescrie lucrările
          pornite.
        </p>
        {JOB_TYPES.map((type) => (
          <Field
            key={type}
            label={JOB_TYPE_LABELS[type]}
            htmlFor={`template-${type}`}
          >
            <Textarea
              id={`template-${type}`}
              rows={5}
              defaultValue={(
                templates[type]?.length
                  ? templates[type]
                  : DEFAULT_TASK_TEMPLATES[type]
              ).join("\n")}
              onBlur={(event) =>
                void updateSettings({
                  task_templates: {
                    ...templates,
                    [type]: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </Field>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Tags className="size-4 text-primary" /> Categorii materiale
        </h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
            >
              {category}
              <button
                type="button"
                aria-label={`Șterge ${category}`}
                onClick={() =>
                  void updateSettings({
                    material_categories: categories.filter(
                      (item) => item !== category,
                    ),
                  })
                }
                className="text-muted-foreground hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Categorie nouă"
          />
          <Button
            variant="outline"
            onClick={() => {
              const value = newCategory.trim();
              if (!value || categories.includes(value)) return;
              void updateSettings({
                material_categories: [...categories, value],
              });
              setNewCategory("");
            }}
          >
            Adaugă
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-primary" /> Notificări
        </h3>

        <PushToggle />

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Ce anume primești:
        </p>
        {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPrefs)[]).map(
          (key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{NOTIFICATION_LABELS[key]}</span>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(checked) =>
                  void updateSettings({
                    notification_prefs: { ...prefs, [key]: checked },
                  })
                }
              />
            </div>
          ),
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4 text-primary" /> Aplicație
        </h3>
        {installed ? (
          <p className="text-sm text-muted-foreground">
            Aplicația este instalată pe acest dispozitiv. ✓
          </p>
        ) : canInstall ? (
          <Button
            className="w-full"
            onClick={async () => {
              const accepted = await install();
              if (accepted) toast.success("Aplicația se instalează");
            }}
          >
            <Download /> Instalează aplicația
          </Button>
        ) : isIOS ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Share className="mt-0.5 size-4 shrink-0" />
            Pe iPhone: apasă <strong>Partajează</strong>, apoi{" "}
            <strong>Adaugă pe ecranul principal</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Deschide site-ul în Chrome sau Safari pe telefon ca să îl poți
            instala.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {mode === "local" ? "Mod local" : "Sincronizare cloud"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {mode === "local"
                ? "Datele sunt doar pe acest dispozitiv"
                : lastSyncAt
                  ? `Ultima sincronizare: ${formatDateTime(lastSyncAt)}`
                  : "Încă nesincronizat"}
              {pendingChanges > 0 && ` · ${pendingChanges} de trimis`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void sync()}>
            <RefreshCw /> Sincronizează
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-primary" /> Oferte
        </h3>
        <Field label="Condiții implicite" hint="Apar pe fiecare ofertă">
          <Textarea
            defaultValue={settings.quote_terms ?? ""}
            onBlur={(event) =>
              void updateSettings({ quote_terms: event.target.value || null })
            }
            placeholder="Garanție 24 luni la manoperă. Avans 40% la confirmare."
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="size-4 text-primary" /> Date demo
        </h3>
        <p className="text-xs text-muted-foreground">
          Încarcă câteva lucrări, clienți și plăți de probă ca să vezi cum arată
          aplicația plină. Toate sunt marcate cu <strong>(DEMO)</strong> și se
          pot șterge oricând.
        </p>
        {demoLoaded ? (
          <Confirm
            title="Ștergi datele demo?"
            description="Se șterg doar înregistrările marcate cu (DEMO)."
            onConfirm={async () => {
              await removeDemoData();
              toast.success("Datele demo au fost șterse");
            }}
          >
            <Button
              variant="outline"
              className="w-full text-red-400 hover:text-red-300"
            >
              <Trash2 /> Șterge datele demo
            </Button>
          </Confirm>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await seedDemoData();
              toast.success("Date demo încărcate");
            }}
          >
            <FlaskConical /> Încarcă date demo
          </Button>
        )}
      </section>

      <ConflictsSection />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <HardHat className="size-4 text-primary" /> Mod șantier
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ascunde prețurile, profitul și paginile de bani. Lângă client, pe
              un telefon ținut în mână, n-au ce căuta la vedere. Ține de acest
              telefon, nu de cont.
            </p>
          </div>
          <Switch
            checked={siteMode}
            onCheckedChange={setSiteMode}
            aria-label="Mod șantier"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Arhivă</h3>
        <p className="text-xs text-muted-foreground">
          Scoate din lista de lucrări comenzile terminate și încasate integral.
          Rămân în rapoarte, la client și în căutare — doar nu-ți mai stau în
          drum.
          {archived.length > 0 && ` Ai ${archived.length} în arhivă.`}
        </p>
        <Field label="Mai vechi de">
          <Select value={archiveMonths} onValueChange={setArchiveMonths}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 luni</SelectItem>
              <SelectItem value="12">un an</SelectItem>
              <SelectItem value="24">doi ani</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Confirm
          title="Arhivezi lucrările vechi?"
          description="Se mută în arhivă doar lucrările terminate și plătite integral. Cele cu rest de încasat rămân la vedere."
          confirmLabel="Arhivează"
          onConfirm={async () => {
            const count = await archiveOldJobs(Number(archiveMonths));
            toast.success(
              count
                ? `${count} lucrări mutate în arhivă`
                : "Nimic de arhivat deocamdată",
            );
          }}
        >
          <Button variant="outline" className="w-full">
            <Archive /> Arhivează lucrările vechi
          </Button>
        </Confirm>
      </section>

      <BackupSection />

      <Confirm
        title="Ieși din cont?"
        description="Datele nesincronizate rămase pe acest dispozitiv se șterg."
        confirmLabel="Ieși"
        onConfirm={() => void signOut()}
      >
        <Button
          variant="outline"
          size="xl"
          className="w-full text-red-400 hover:text-red-300"
        >
          <LogOut />{" "}
          {mode === "local" ? "Resetează datele locale" : "Ieși din cont"}
        </Button>
      </Confirm>
    </div>
  );
}
