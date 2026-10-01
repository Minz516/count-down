"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react/ssr";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const CHANGE_EVENT = "themechange";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Explicit choice wins (data-theme on <html>, see the inline script in app/layout.tsx), otherwise the OS preference. */
function getTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(LIGHT_QUERY);
  window.addEventListener(CHANGE_EVENT, onChange);
  query.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    query.removeEventListener("change", onChange);
  };
}

function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private window); the choice then lasts for this page view only.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return [theme, toggle];
}

/** Row for the account menu (UserMenu.tsx). */
export function ThemeMenuItem({ onSelect }: { onSelect?: () => void }) {
  const [theme, toggle] = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        toggle();
        onSelect?.();
      }}
      className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-body text-sm text-on-surface transition-colors hover:bg-surface-container"
    >
      <Icon size={16} />
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

/** Standalone icon button for signed-out screens (login, signup). */
export function ThemeIconButton({ className }: { className?: string }) {
  const [theme, toggle] = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={
        className ??
        "rounded-lg p-3 text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
      }
    >
      <Icon size={20} />
    </button>
  );
}
