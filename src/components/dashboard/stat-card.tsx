import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cifră mare + etichetă. Blocul de bază al dashboard-ului. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "secondary";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-muted-foreground bg-elevated",
    primary: "text-primary bg-primary/12",
    secondary: "text-sky-300 bg-sky-500/12",
    success: "text-emerald-300 bg-emerald-500/12",
    warning: "text-amber-300 bg-amber-500/12",
    danger: "text-red-300 bg-red-500/12",
  };

  const glow: Record<string, string> = {
    default: "from-white/[0.04]",
    primary: "from-primary/[0.13]",
    secondary: "from-sky-500/[0.12]",
    success: "from-emerald-500/[0.12]",
    warning: "from-amber-500/[0.12]",
    danger: "from-red-500/[0.12]",
  };

  const content = (
    <div
      className={cn(
        "card-hover surface group relative h-full overflow-hidden rounded-2xl p-3.5 sm:p-4",
        className,
      )}
    >
      {/* Lumina din colț dă adâncime cardului fără să încarce conținutul. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-gradient-to-br to-transparent blur-2xl",
          glow[tone],
        )}
      />

      <div className="relative flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-transform duration-[--dur-2] ease-[--ease-spring] group-hover:scale-110 group-active:scale-90",
              tones[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <p className="text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
