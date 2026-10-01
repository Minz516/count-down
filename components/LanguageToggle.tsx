"use client";

import { useRouter } from "next/navigation";
import { Translate } from "@phosphor-icons/react/ssr";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";

function useLanguageSwitch(): [Locale, () => void] {
  const router = useRouter();
  const locale = useLocale();

  function toggle() {
    const next: Locale = locale === "en" ? "vi" : "en";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    // Server Components read the cookie, so they must render again for the new language.
    router.refresh();
  }

  return [locale, toggle];
}

/** Row for the account menu (UserMenu.tsx). The label is the language you will switch TO, in that language. */
export function LanguageMenuItem({ onSelect }: { onSelect?: () => void }) {
  const t = useT();
  const [, toggle] = useLanguageSwitch();

  return (
    <button
      type="button"
      role="menuitem"
      lang={t("lang.target") === "English" ? "en" : "vi"}
      aria-label={t("lang.switchAria")}
      onClick={() => {
        toggle();
        onSelect?.();
      }}
      className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-body text-sm text-on-surface transition-colors hover:bg-surface-container"
    >
      <Translate aria-hidden="true" size={16} />
      {t("lang.target")}
    </button>
  );
}

/** Standalone button for signed-out screens (login, signup). */
export function LanguageButton() {
  const t = useT();
  const [, toggle] = useLanguageSwitch();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("lang.switchAria")}
      lang={t("lang.target") === "English" ? "en" : "vi"}
      className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-body text-sm text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
    >
      <Translate aria-hidden="true" size={18} />
      {t("lang.target")}
    </button>
  );
}
