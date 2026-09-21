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
 *
 * `animate` pune marca să se ridice bucată cu bucată, în ordinea în care s-ar
 * monta pe teren: întâi scara, apoi lemnul, apoi betonul. Se folosește doar
 * acolo unde marca e eroul ecranului — la autentificare și la pornire —, nu în
 * antet, unde ar clipi la fiecare schimbare de pagină.
 */
export function LogoMark({
  className,
  animate,
}: {
  className?: string;
  animate?: boolean;
}) {
  const step = (delay: number) =>
    animate
      ? {
          style: {
            animation: `rise var(--dur-3) var(--ease-out) ${delay}ms both`,
          },
        }
      : {};

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
        {...step(0)}
      />
      <path
        d={BRAND_WOOD_PATH}
        fill={`var(--wood, ${BRAND_WOOD})`}
        {...step(90)}
      />
      <path
        d={BRAND_CONCRETE_PATH}
        fill={`var(--concrete, ${BRAND_CONCRETE})`}
        {...step(180)}
      />
    </svg>
  );
}
