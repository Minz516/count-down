"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createT, type Locale, type TFunction } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  t: TFunction;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provided once by app/layout.tsx with the locale read from the `lang` cookie on the server.
 * When the toggle changes the cookie it refreshes the router, the layout re-renders with the new
 * locale, and everything below updates together.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useT and useLocale must be used inside <LocaleProvider>.");
  return value;
}

export function useT(): TFunction {
  return useLocaleContext().t;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
