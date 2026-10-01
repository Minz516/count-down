"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, UsersThree } from "@phosphor-icons/react/ssr";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { focusIfFinePointer } from "@/lib/focus";
import { createClient } from "@/lib/supabase/client";
import { groupsInterface, type GroupDTO } from "@/modules/groups/groups.interface";
import { useT } from "./LocaleProvider";

interface GroupsListClientProps {
  initialGroups: GroupDTO[];
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50";

/** Groups list + Create/Join flows (docs/milestone2/UI_SPEC-milestone-2.md "Groups (list)"). */
export function GroupsListClient({ initialGroups }: GroupsListClientProps) {
  const t = useT();
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<GroupDTO | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const supabase = createClient();
      const group = await groupsInterface.createGroup(supabase, name);
      setCreatedGroup(group);
      setName("");
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? t.text(err.message) : t("error.createGroup"));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setJoinError(null);
    setJoining(true);

    try {
      const supabase = createClient();
      const group = await groupsInterface.joinGroup(supabase, code);
      router.push(`/groups/${group.id}`);
    } catch (err) {
      setJoinError(err instanceof Error ? t.text(err.message) : t("error.joinGroup"));
      setJoining(false);
    }
  }

  async function handleCopyCreated() {
    if (!createdGroup) return;
    await navigator.clipboard.writeText(createdGroup.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            setCreateOpen((value) => !value);
            setJoinOpen(false);
          }}
        >
          <Plus aria-hidden="true" size={16} weight="bold" />
          {t("groups.create")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setJoinOpen((value) => !value);
            setCreateOpen(false);
          }}
        >
          {t("groups.join")}
        </Button>
      </div>

      {createdGroup && (
        <div className="flex max-w-xl items-center justify-between rounded-lg border border-primary-container/15 bg-surface-container px-4 py-3">
          <div>
            <p className="font-body text-sm text-on-surface">
              {t("groups.createdShare", { name: createdGroup.name })}
            </p>
            <p translate="no" className="mt-1 font-mono text-lg tracking-[0.15em] text-on-surface">
              {createdGroup.invite_code}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCreated}
            aria-label={t("common.copyInviteCode")}
            className="rounded p-3 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            {copied ? <Check aria-hidden="true" size={18} className="text-primary" /> : <Copy aria-hidden="true" size={18} />}
          </button>
        </div>
      )}

      {createOpen && (
        <form
          onSubmit={handleCreate}
          className="flex max-w-xl flex-col gap-3 rounded-lg border border-primary-container/15 bg-surface-container p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              {t("common.groupName")}
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("groups.namePlaceholder")}
              name="group_name"
              autoComplete="off"
              maxLength={100}
              className={inputClass}
              ref={focusIfFinePointer}
            />
          </label>
          {createError && <p role="alert" className="font-body text-sm text-error">{createError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? t("common.creating") : t("common.create")}
            </Button>
          </div>
        </form>
      )}

      {joinOpen && (
        <form
          onSubmit={handleJoin}
          className="flex max-w-xl flex-col gap-3 rounded-lg border border-primary-container/15 bg-surface-container p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              {t("common.inviteCode")}
            </span>
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t("groups.codePlaceholder")}
              name="invite_code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={inputClass}
              ref={focusIfFinePointer}
            />
          </label>
          {joinError && <p role="alert" className="font-body text-sm text-error">{joinError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={joining}>
              {joining ? t("common.joining") : t("common.join")}
            </Button>
          </div>
        </form>
      )}

      {initialGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-primary-container/10 bg-surface-container px-6 py-16 text-center">
          <UsersThree aria-hidden="true" size={32} className="text-text-muted" />
          <h2 className="text-balance font-display text-xl font-semibold text-on-surface">{t("groups.empty.title")}</h2>
          <p className="max-w-sm font-body text-sm text-text-muted">
            {t("groups.empty.body")}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {initialGroups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex items-center justify-between rounded-lg border border-primary-container/10 bg-surface-container px-5 py-4 transition-[transform,background-color,border-color] duration-150 hover:-translate-y-px hover:border-primary-container/20 hover:bg-surface-elevated"
              >
                <span className="truncate font-body text-base font-semibold text-on-surface">
                  {group.name}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  {group.preview_avatars.length > 0 && (
                    <div className="flex items-center -space-x-2">
                      {group.preview_avatars.map((avatarUrl, index) => (
                        <Avatar
                          key={index}
                          src={avatarUrl}
                          alt=""
                          size={22}
                          className="border-2 border-surface-container"
                        />
                      ))}
                    </div>
                  )}
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 font-mono text-xs tracking-[0.1em] text-primary tabular-nums uppercase">
                    {group.member_count} / 10
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
