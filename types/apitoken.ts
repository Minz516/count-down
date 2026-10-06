/** A row of `api_tokens` as signed-in users may read it. `token_hash` is deliberately absent: the database
 * grants no one that column, so it can never be selected. Repository-internal - see
 * modules/apitokens/apitokens.dto.ts for what components consume. */
export interface ApiTokenEntity {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  created_at: string; // ISO timestamptz
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

/** What create_api_token() returns, once. The only place the plain token ever exists. */
export interface CreatedApiTokenEntity {
  id: string;
  token: string;
  token_prefix: string;
  created_at: string;
}

/** What the create dialog collects. */
export interface ApiTokenInput {
  name: string;
  /** ISO timestamp in the future, or omitted for a token that never expires. */
  expiresAt?: string | null;
}
