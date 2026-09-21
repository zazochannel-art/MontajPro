import {
  BRAND_CONCRETE,
  BRAND_CONCRETE_PATH,
  BRAND_STAIRS_PATH,
  BRAND_STAIRS_WIDTH,
  BRAND_VIEWBOX,
  BRAND_WOOD,
  BRAND_WOOD_PATH,
} from "@/lib/brand";

/**
 * Marca MontCraft.
 *
 * Ordinea contează: scara se desenează prima, iar piesa de lemn peste ea —
 * așa treapta de sus se oprește exact sub diagonală, ca pe firmă, fără să fie
 * nevoie de o tăietură desenată de mână.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={BRAND_VIEWBOX}
      className={className}
      role="img"
      aria-label="MontCraft"
      fill="none"
    >
      <path
        d={BRAND_STAIRS_PATH}
        stroke={`var(--concrete, ${BRAND_CONCRETE})`}
        strokeWidth={BRAND_STAIRS_WIDTH}
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
      <path d={BRAND_WOOD_PATH} fill={`var(--wood, ${BRAND_WOOD})`} />
      <path d={BRAND_CONCRETE_PATH} fill={`var(--concrete, ${BRAND_CONCRETE})`} />
    </svg>
  );
}
