import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

export function Logo({
  className,
  compact,
  tagline,
}: {
  className?: string;
  compact?: boolean;
  /** Rândul de sub nume, ca pe firmă. Doar unde e loc: pe login, nu în antet. */
  tagline?: boolean;
}) {
  if (tagline) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <LogoMark className="h-14 w-auto" animate />
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold uppercase tracking-tight">
            Mont<span className="text-wood-light">Craft</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Custom interior works
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-auto shrink-0" />
      {!compact && (
        <span className="text-lg font-bold uppercase tracking-tight">
          Mont<span className="text-wood-light">Craft</span>
        </span>
      )}
    </div>
  );
}
