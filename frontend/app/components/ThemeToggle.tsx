"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-8 h-8" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "relative w-8 h-8 rounded-lg flex items-center justify-center",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted transition-all duration-200",
        "active:scale-90 theme-icon-spin",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-blue/50",
      ].join(" ")}
    >
      {isDark ? (
        <Sun size={16} strokeWidth={2} />
      ) : (
        <Moon size={16} strokeWidth={2} />
      )}
    </button>
  );
}
