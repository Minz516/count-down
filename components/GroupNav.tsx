"use client";

import Link from "next/link";
import { ArrowLeft, Gear, Plus } from "@phosphor-icons/react/ssr";
import { Button } from "./Button";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

interface GroupNavProps {
  groupName: string;
  memberCount: number;
  onAddEvent: () => void;
  onOpenSettings: () => void;
}

/**
 * Group Dashboard's header - same building blocks as Nav.tsx, scoped to one group instead of
 * the personal dashboard. On small screens the name gets its own full-width row under the
 * action bar so it is never truncated to a few letters, and the member count stays on one line.
 */
export function GroupNav({ groupName, memberCount, onAddEvent, onOpenSettings }: GroupNavProps) {
  return (
    <header className="border-b border-primary-container/10">
      <div className="mx-auto flex max-w-[1120px] flex-col px-4 sm:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <Link
              href="/groups"
              aria-label="Back to groups"
              className="shrink-0 rounded p-3 text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2 sm:p-2"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate font-display text-lg font-semibold text-on-surface">{groupName}</p>
              <p className="whitespace-nowrap font-mono text-[11px] tracking-[0.1em] text-text-muted uppercase">
                {memberCount} / 10 thành viên
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button onClick={onAddEvent} className="min-h-11 px-3 sm:px-4">
              <Plus size={16} weight="bold" />
              Add Event
            </Button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Group settings"
              className="rounded p-3 text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2 sm:p-2"
            >
              <Gear size={20} />
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>

        <div className="min-w-0 pb-4 sm:hidden">
          <p className="font-display text-xl font-semibold text-on-surface">{groupName}</p>
          <p className="whitespace-nowrap font-mono text-[11px] tracking-[0.1em] text-text-muted uppercase">
            {memberCount} / 10 thành viên
          </p>
        </div>
      </div>
    </header>
  );
}
