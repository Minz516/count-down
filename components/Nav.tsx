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
 */
export function Nav({ onAddEvent }: NavProps) {
  const pathname = usePathname();

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-primary-container/10 px-4 sm:px-12">
      <div className="flex items-center gap-6 sm:gap-10">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-display text-lg font-semibold text-on-surface">Countdown</span>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          {TABS.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 border-b-2 px-1 py-1.5 font-mono text-xs font-medium tracking-[0.1em] uppercase transition-colors sm:px-2",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted hover:text-on-surface",
                )}
              >
                <Icon size={16} weight={active ? "bold" : "regular"} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {onAddEvent && (
          <>
            <Button onClick={onAddEvent} className="hidden sm:inline-flex">
              <Plus size={16} weight="bold" />
              Add Event
            </Button>
            <button
              type="button"
              onClick={onAddEvent}
              aria-label="Add event"
              className="rounded p-2 text-primary sm:hidden"
            >
              <Plus size={20} weight="bold" />
            </button>
          </>
        )}
        <NotificationBell />
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
        >
          <Gear size={20} />
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
