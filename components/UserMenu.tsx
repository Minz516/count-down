"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, SignOut } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import { EditProfileModal } from "./EditProfileModal";
import { createClient } from "@/lib/supabase/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { notificationsCleared } from "@/lib/store/notificationsSlice";
import { fetchSession, profileUpdated, sessionCleared } from "@/lib/store/sessionSlice";
import { authInterface } from "@/modules/auth/auth.interface";

/**
 * Account icon that opens a small menu instead of signing out on the first
 * click (docs/UI_SPEC.md) - shared by Nav.tsx and GroupNav.tsx, which
 * previously each had their own inline icon-button-signs-out-immediately logic.
 *
 * The user/profile it shows comes from lib/store/sessionSlice.ts, not a local fetch:
 * Nav and GroupNav render a fresh UserMenu instance on every tab switch (they're not
 * behind a shared layout), so fetching per-mount meant re-hitting Supabase Auth + the
 * profiles table on every navigation. Dispatching fetchSession() only while its status
 * is still "idle" means the first mount fetches once and every later mount just reads
 * the already-cached value from the store.
 */
export function UserMenu() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const userId = useAppSelector((state) => state.session.userId);
  const profile = useAppSelector((state) => state.session.profile);
  const status = useAppSelector((state) => state.session.status);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "idle") {
      void dispatch(fetchSession());
    }
  }, [status, dispatch]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    const supabase = createClient();
    await authInterface.signOut(supabase);
    // Clear the cached session/notifications so a different account signing in on this
    // same tab never briefly sees the previous user's avatar/notifications.
    dispatch(sessionCleared());
    dispatch(notificationsCleared());
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar src={profile?.avatar_url ?? null} alt="" size={26} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border border-primary-container/15 bg-surface-elevated py-1"
        >
          {profile && (
            <p className="truncate px-3 py-1.5 font-body text-xs text-text-muted">{profile.username}</p>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setEditOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-sm text-on-surface transition-colors hover:bg-surface-container"
          >
            <PencilSimple size={16} />
            Edit profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-sm text-on-surface transition-colors hover:bg-surface-container"
          >
            <SignOut size={16} />
            Log out
          </button>
        </div>
      )}

      {editOpen && userId && (
        <EditProfileModal
          userId={userId}
          initialProfile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => dispatch(profileUpdated(updated))}
        />
      )}
    </div>
  );
}
