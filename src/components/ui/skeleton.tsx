import { cn } from "@/lib/utils";

/**
 * Locul gol cât se încarcă datele. Are o sclipire care trece peste el: arată
 * că aplicația lucrează, nu că a înghețat.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl bg-muted", className)}
      style={{
        backgroundImage:
          "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.055) 42%, rgba(255,255,255,0.055) 58%, transparent 80%)",
        backgroundSize: "220% 100%",
        animation: "shimmer 1.6s linear infinite",
      }}
      {...props}
    />
  );
}
