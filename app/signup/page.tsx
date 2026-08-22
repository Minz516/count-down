import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  // AuthForm reads ?error=oauth_failed via useSearchParams(), which requires a Suspense
  // boundary on a statically-rendered page like this one.
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
