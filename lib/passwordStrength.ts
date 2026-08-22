/**
 * Shared between the live guidance checklist in AuthForm.tsx and the final
 * gate in auth.service.ts's signUp - one set of rules, not two copies that
 * could drift apart.
 */
export interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (password) => password.length >= 8 },
  { label: "One uppercase letter", test: (password) => /[A-Z]/.test(password) },
  { label: "One lowercase letter", test: (password) => /[a-z]/.test(password) },
  { label: "One number", test: (password) => /[0-9]/.test(password) },
  { label: "One special character", test: (password) => /[^A-Za-z0-9]/.test(password) },
];

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
}
