"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Slot } from "radix-ui";

/**
 * Re-renders the server components every `seconds` (and when its child is clicked).
 * Only the cards' data is re-fetched — the page doesn't reload.
 * Pauses while the tab is hidden.
 */
export function AutoRefresh({ seconds = 60, children }: { seconds?: number; children?: React.ReactElement }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => startTransition(() => router.refresh()), [router]);

  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [refresh, seconds]);

  if (!children) return null;
  return (
    <Slot.Root onClick={refresh} data-pending={pending || undefined} aria-busy={pending} className="data-[pending]:[&_svg]:animate-spin">
      {children}
    </Slot.Root>
  );
}
