/** A row from the `profiles` table (see docs/ARCHITECTURE.md "Auth Flow"). */
export interface ProfileRecord {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string; // ISO timestamptz
}

/** Fields the Edit Profile form collects. */
export interface ProfileInput {
  username: string;
  avatar_url: string | null;
}
