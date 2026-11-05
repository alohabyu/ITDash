"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Toggles `.dark` on <html>; persists the choice in localStorage. */
export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
