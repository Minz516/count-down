/**
 * The public contract for the `auth` module. Pages and components import from
 * here only - never from auth.repository.ts or auth.service.ts directly.
 */
export { authService as authInterface } from "./auth.service";
export type { SignUpInput } from "./auth.service";
export type { OAuthProvider } from "./auth.repository";
