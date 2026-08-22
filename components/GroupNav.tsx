"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gear, Plus, UserCircle } from "@phosphor-icons/react/ssr";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { Button } from "./Button";

interface GroupNavProps {
  groupName: string;
  memberCount: number;
  onAddEvent: () => void;
  onOpenSettings: () => void;
}

/** Group Dashboard's header - same building blocks as Nav.tsx, scoped to one group instead of the personal dashboard. */
export function GroupNav({ groupName, memberCount, onAddEvent, onOpenSettings }: GroupNavProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await authInterface.signOut(supabase);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-primary-container/10 px-4 sm:px-12">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/groups"
          aria-label="Back to groups"
          className="shrink-0 rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-on-surface">{groupName}</p>
          <p className="font-mono text-[11px] tracking-[0.1em] text-text-muted uppercase">
            {memberCount} / 10 thành viên
          </p>
        </div>
      </div>

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
          onClick={onOpenSettings}
          aria-label="Group settings"
          className="rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
        >
          <Gear size={20} />
        </button>
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
