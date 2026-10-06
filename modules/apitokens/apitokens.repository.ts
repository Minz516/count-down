import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { ApiTokenEntity, CreatedApiTokenEntity } from "@/types/apitoken";

/**
 * All Supabase access for personal access tokens. Reads name every column explicitly: `token_hash` is not
 * granted to anyone, so `select *` would fail by design and listing it must never be attempted. Creating and
 * revoking go through security definer functions (the table has no client write policy), which derive the
 * owner from the signed-in session.
 */
const TOKEN_COLUMNS = "id, user_id, name, token_prefix, created_at, last_used_at, expires_at, revoked_at";

export const apiTokensRepository = {
  async list(supabase: SupabaseClient, userId: string): Promise<ApiTokenEntity[]> {
    const { data, error } = await supabase
      .from("api_tokens")
      .select(TOKEN_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as unknown as ApiTokenEntity[];
  },

  async create(supabase: SupabaseClient, name: string, expiresAt: string | null): Promise<CreatedApiTokenEntity> {
    const { data, error } = await supabase
      .rpc("create_api_token", { p_name: name, p_expires_at: expiresAt })
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as CreatedApiTokenEntity;
  },

  async revoke(supabase: SupabaseClient, tokenId: string): Promise<void> {
    const { error } = await supabase.rpc("revoke_api_token", { p_token_id: tokenId });
    if (error) throw new DatabaseError(error.message);
  },
};
