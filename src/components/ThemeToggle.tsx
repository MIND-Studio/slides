"use client";

import { Button, useMindTheme } from "@mind-studio/ui";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Light/dark switch for the Next app chrome (NOT the deck palette — that's the
 * DeckSpec `theme`). Gated on a mounted flag so the icon doesn't flash the
 * wrong glyph during hydration.
 */
export default function ThemeToggle() {
  const { resolvedMode, setMode } = useMindTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedMode === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setMode(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
