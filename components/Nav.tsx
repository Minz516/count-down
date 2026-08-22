"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Gear, Plus, UserCircle } from "@phosphor-icons/react/ssr";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { Button } from "./Button";

export function Nav({ onAddEvent }: { onAddEvent: () => void }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await authInterface.signOut(supabase);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-primary-container/10 px-4 sm:px-12">
      <span className="font-display text-lg font-semibold text-on-surface">Countdown</span>

      <div className="flex items-center gap-2 sm:gap-3">
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
        <button
          type="button"
          aria-label="Notifications"
          className="rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
        >
          <Bell size={20} />
        </button>
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
        >
          <Gear size={20} />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          className="rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
        >
          <UserCircle size={22} />
        </button>
      </div>
    </header>
  );
}
