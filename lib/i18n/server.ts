import { cookies } from "next/headers";
import { createT, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/** The viewer's interface language, from the `lang` cookie the toggle sets. Server Components only. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  return createT(await getLocale());
}
