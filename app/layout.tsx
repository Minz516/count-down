import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Manrope } from "next/font/google";
import { LocaleProvider } from "@/components/LocaleProvider";
import { StoreProvider } from "@/components/StoreProvider";
import { getLocale, getT } from "@/lib/i18n/server";
import { createT } from "@/lib/i18n";
import "./globals.css";

// Vietnamese subset is required: timeline status labels ("Đã qua", "Hôm nay",
// "còn X ngày", "Lặp lại - ... hàng tuần") rely on Vietnamese diacritics.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "Countdown",
    description: t("app.description"),
    icons: { icon: "/logo.png" },
  };
}

// Runs before first paint so a saved light/dark choice never flashes the other theme.
// Without a saved choice the CSS follows prefers-color-scheme on its own.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// Mobile browser chrome follows the OS theme; matches --surface-deep in app/globals.css.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = createT(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${hankenGrotesk.variable} ${manrope.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-surface-deep font-body text-on-surface antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-primary-container focus:px-4 focus:py-2 focus:font-body focus:text-sm focus:font-medium focus:text-on-primary-container"
        >
          {t("app.skipToMain")}
        </a>
        <LocaleProvider locale={locale}>
          <StoreProvider>{children}</StoreProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
