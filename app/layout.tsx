import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Manrope } from "next/font/google";
import { StoreProvider } from "@/components/StoreProvider";
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

export const metadata: Metadata = {
  title: "Countdown",
  description: "Track your deadlines with a live, real-time countdown.",
  icons: { icon: "/logo.png" },
};

// Runs before first paint so a saved light/dark choice never flashes the other theme.
// Without a saved choice the CSS follows prefers-color-scheme on its own.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hankenGrotesk.variable} ${manrope.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-surface-deep font-body text-on-surface antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
