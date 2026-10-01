"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gear, Plus, User, UsersThree } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { Button } from "./Button";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

interface NavProps {
  /** Omitted on screens with no "add event" action (e.g. the Groups list) - hides the button entirely. */
  onAddEvent?: () => void;
}

const TABS = [
  { href: "/", label: "Personal", icon: User, isActive: (path: string) => path === "/" },
  { href: "/groups", label: "Group", icon: UsersThree, isActive: (path: string) => path.startsWith("/groups") },
];

/**
 * Top-level nav, shared by the Personal Dashboard and the Groups list
 * (references/dashboard-nav-bar.png) - a single group's own dashboard keeps
 * its separate `GroupNav` instead (a drill-down view, not a top-level tab).
 *
 * Small screens: the top bar keeps only the logo, one Add Event button, the bell and the
 * account menu (Settings moves into that menu), and the Personal/Group tabs move to a
 * labelled bottom bar. From `sm` up the tabs sit in the header as before. The header's
 * inner width matches the page content width (max-w-[1120px]) so the two line up.
 */
export function Nav({ onAddEvent }: NavProps) {
  const pathname = usePathname();

  return (
    <>
      <header className="border-b border-primary-container/10">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-6 sm:gap-10">
            <div className="flex shrink-0 items-center gap-2">
              <Image src="/logo.png" alt="" width={28} height={28} priority className="rounded-lg" />
              <span translate="no" className="font-display text-lg font-semibold text-on-surface">Countdown</span>
            </div>

            <nav aria-label="Primary" className="hidden items-center gap-2 sm:flex">
              {TABS.map(({ href, label, icon: Icon, isActive }) => {
                const active = isActive(pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-1.5 border-b-2 px-2 py-2 font-mono text-xs font-medium tracking-[0.1em] uppercase transition-colors",
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-text-muted hover:text-on-surface",
                    )}
                  >
                    <Icon aria-hidden="true" size={16} weight={active ? "bold" : "regular"} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {onAddEvent && (
              <Button onClick={onAddEvent} className="min-h-11 px-3 sm:px-4">
                <Plus aria-hidden="true" size={16} weight="bold" />
                Add Event
              </Button>
            )}
            <NotificationBell />
            <Link
              href="/settings"
              aria-label="Settings"
              className="hidden rounded p-2 text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2 sm:block"
            >
              <Gear aria-hidden="true" size={20} />
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-primary-container/15 bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-2">
          {TABS.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 font-body text-xs font-medium transition-colors",
                    active ? "text-primary" : "text-text-muted",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                      active && "bg-primary-container/20",
                    )}
                  >
                    <Icon aria-hidden="true" size={20} weight={active ? "bold" : "regular"} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
