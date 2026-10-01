import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryOptions";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init(sentryOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
