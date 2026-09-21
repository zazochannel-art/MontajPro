"use client";

import { cn } from "@/lib/utils";

/**
 * Filtre sub formă de „pastile” derulabile orizontal — alternativa mobilă la
 * tabelele cu filtre.
 *
 * Pastila activă nu-și schimbă doar culoarea: primește un fundal plin și o
 * umbră, ca să se vadă dintr-o privire pe ce filtru ești, chiar și în soare.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex shrink-0 select-none items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium",
              "transition-[background-color,border-color,color,box-shadow,transform] duration-[--dur-1] ease-[--ease-out] active:scale-[0.96]",
              active
                ? "border-transparent bg-gradient-to-b from-primary-soft to-primary text-primary-foreground shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
                : "border-border bg-elevated text-muted-foreground shadow-[var(--lift)] hover:border-border-strong hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-black/20 text-primary-foreground" : "bg-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
