"use client";

import { useCallback } from "react";
import { useApp } from "@/lib/app-provider";
import { isLang, translate, type Lang } from "@/lib/i18n";

/** Limba aleasă de om. Româna e implicită și e și limba în care scrie codul. */
export function useLang(): Lang {
  const { settings } = useApp();
  return isLang(settings?.language) ? settings.language : "ro";
}

/**
 * Traducătorul.
 *
 * Se cheamă `t` fiindcă apare de sute de ori: `t("Lucrări")`. Textul românesc
 * rămâne în cod — el e și cheia — deci un ecran netradus arată în română, nu
 * gol.
 */
export function useT(): (text: string) => string {
  const lang = useLang();
  return useCallback((text: string) => translate(lang, text), [lang]);
}
