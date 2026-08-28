"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";

/**
 * Mounted once in the root layout (app/layout.tsx), which never unmounts across
 * navigations - so the store instance, and the session/notifications it caches,
 * survives every tab switch instead of being rebuilt (and refetched) per page.
 *
 * The store is created lazily via useState's initializer, not at module scope: a
 * module-scope `export const store = configureStore(...)` would be shared across
 * concurrent requests if this were ever imported into server-rendered code (Redux's
 * own Next.js guidance) - scoping it to this component instance avoids that even
 * though, being "use client", this only ever runs in the browser today. (A `useRef`
 * lazy-init would do the same thing but trips this project's react-hooks/refs lint
 * rule, which forbids reading `ref.current` during render.)
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
