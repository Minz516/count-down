"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { X } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { profilesInterface } from "@/modules/profiles/profiles.interface";
import type { ProfileRecord } from "@/types/profile";

interface EditProfileModalProps {
  userId: string;
  initialProfile: ProfileRecord | null;
  onClose: () => void;
  onSaved: (profile: ProfileRecord) => void;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus:outline-none";

/** Username + avatar upload, opened from UserMenu.tsx's "Edit profile" item. */
export function EditProfileModal({ userId, initialProfile, onClose, onSaved }: EditProfileModalProps) {
  const [username, setUsername] = useState(initialProfile?.username ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialProfile?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke the object URL created for the local preview on unmount/replacement -
  // it's only needed for this session's preview, not worth leaking.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextPreviewUrl;

    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setError(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const supabase = createClient();

      let avatarUrl = initialProfile?.avatar_url ?? null;
      if (selectedFile) {
        avatarUrl = await profilesInterface.uploadAvatar(supabase, userId, selectedFile);
      }

      const updated = await profilesInterface.updateProfile(supabase, userId, {
        username,
        avatar_url: avatarUrl,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-deep/70 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-on-surface">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <Avatar src={previewUrl} alt="" size={72} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              Change avatar
            </Button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              Username
            </span>
            <input
              type="text"
              value={username}
              onChange={(inputEvent) => setUsername(inputEvent.target.value)}
              required
              autoComplete="username"
              className={inputClass}
            />
          </label>

          {error && <p className="font-body text-sm text-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
