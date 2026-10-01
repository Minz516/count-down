import { en, vi, viPhrases, viPhrasePatterns, type MessageKey, type Messages } from "./messages";

export type { MessageKey } from "./messages";

export type Locale = "en" | "vi";

/** English is the default for everyone, including first-time visitors (set deliberately, not detected). */
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

type Vars = Record<string, string | number>;

export interface TFunction {
  (key: MessageKey, vars?: Vars): string;
  /**
   * Translates a plain English message that arrives from outside the dictionary (service-layer
   * errors, password rule labels). Unknown text is returned unchanged rather than hidden.
   */
  text(english: string): string;
}

const TABLES: Record<Locale, Messages> = { en, vi };

export function createT(locale: Locale): TFunction {
  const table = TABLES[locale];

  const t = ((key: MessageKey, vars?: Vars) => {
    const template = table[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
  }) as TFunction;

  t.text = (english: string) => {
    if (locale === "en") return english;
    const exact = viPhrases[english];
    if (exact) return exact;
    for (const [pattern, build] of viPhrasePatterns) {
      const match = english.match(pattern);
      if (match) return build(match);
    }
    return english;
  };

  return t;
}
