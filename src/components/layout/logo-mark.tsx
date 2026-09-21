/**
 * Marca MontCraft.
 *
 * Un „M" din două jumătăți: piciorul stâng și diagonala care coboară sunt din
 * lemn, urcarea și piciorul drept sunt din beton. În unghiul de jos stau
 * treptele — lucrul pe care îl face omul care ține telefonul.
 *
 * Desenul e geometric, nu o urmă a logoului tipărit: la 24 de pixeli, în
 * antet, texturile n-ar însemna nimic, iar forma trebuie să rămână citibilă.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="MontCraft"
      fill="none"
    >
      {/* Jumătatea de lemn: piciorul din stânga și coborârea spre vale. */}
      <path
        d="M 12 90 L 12 14 L 50 60"
        stroke="var(--wood, #b5723e)"
        strokeWidth="15"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
      {/* Jumătatea de beton: urcarea spre al doilea vârf și piciorul drept. */}
      <path
        d="M 50 60 L 88 14 L 88 90"
        stroke="var(--concrete, #e8e6e0)"
        strokeWidth="15"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
      {/* Treptele, în golul de sub diagonala de lemn. */}
      <path
        d="M 48 70 L 40 70 L 40 77 L 32 77 L 32 84 L 24 84 L 24 90 L 48 90 Z"
        fill="var(--concrete, #e8e6e0)"
      />
    </svg>
  );
}
