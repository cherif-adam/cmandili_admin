"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

/**
 * Light/dark switch. The choice is stored per browser and applied as
 * `data-theme` on <html>, which every colour token in globals.css keys off.
 *
 * The initial value is applied by an inline script in the root layout, before
 * first paint — reading localStorage here would leave a flash of the wrong
 * theme on every page load.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("amana-theme", next);
    } catch {
      // Private browsing or blocked storage: the theme still applies for this
      // page, it just will not be remembered.
    }
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Passer en clair" : "Passer en sombre"}
      aria-label="Changer de thème"
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
      style={{ color: "var(--text-muted)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
