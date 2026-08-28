/** A row from the `profiles` table (see docs/ARCHITECTURE.md "Auth Flow"). Repository-internal -
 * see modules/profiles/profiles.dto.ts for the DTO pages/components actually consume. */
export interface ProfileEntity {
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
