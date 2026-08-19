"use client"
/**
 * Console theme — light (default) / dark / follow the system.
 *
 * The default flipped to LIGHT on 2026-08-17 with the Hairline Mosaic rebuild.
 * The console's own light register is no longer the landing's warm paper: it is
 * a dedicated bright-white board, and it is what the operator gets unless they
 * ask for the dark one. Dark remains a full, gated parity register.
 *
 * ── Why a class on the shell rather than a data-attribute on <html> ───────
 *
 * The two registers are already expressed as CSS custom-property blocks in
 * globals.css, scoped to `.register-dark, .simulator-shell` (console) and
 * `:root` (paper). The console shell has carried the dark class
 * unconditionally since the register split, so the machinery for switching is
 * almost entirely present — what was missing is a way to opt OUT of it.
 *
 * So: `.simulator-shell` no longer implies dark. It carries
 * `.register-dark` or `.register-paper` explicitly, and this hook decides
 * which. That keeps every existing token reference working untouched, and it
 * keeps the landing on `:root` paper regardless of what the operator picks —
 * the theme choice is a property of the CONSOLE, which is the surface someone
 * stares at for a whole shift, not of the marketing site.
 *
 * ── The flash ─────────────────────────────────────────────────────────────
 *
 * Reading localStorage in an effect means the first paint uses the default and
 * then corrects, which on a dark-by-default console is a white flash straight
 * into someone's eyes at 3am. `themeInitScript` below runs BEFORE paint from
 * the layout and stamps the class itself; the hook then adopts whatever is
 * already there rather than re-deciding.
 */

import { useCallback, useEffect, useState } from "react"

export type ThemeChoice = "dark" | "light" | "system"
export type ResolvedTheme = "dark" | "light"

const KEY = "aeolus-console-theme"

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }
  return choice
}

/**
 * Inlined into <head> so the register is decided before first paint.
 * Kept deliberately tiny and dependency-free — it runs as a raw string.
 */
export const themeInitScript = `
(function(){
  try {
    var c = localStorage.getItem(${JSON.stringify(KEY)}) || "light";
    var r = c === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : c;
    document.documentElement.setAttribute("data-console-theme", r);
  } catch (e) {
    document.documentElement.setAttribute("data-console-theme", "light");
  }
})();
`

export function useConsoleTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("light")
  const [resolved, setResolved] = useState<ResolvedTheme>("light")

  // Adopt whatever the init script already decided, so the hook never causes a
  // second paint on mount.
  useEffect(() => {
    let saved: ThemeChoice = "light"
    try {
      const raw = localStorage.getItem(KEY)
      if (raw === "dark" || raw === "light" || raw === "system") saved = raw
    } catch {}
    setChoice(saved)
    setResolved(resolveTheme(saved))
  }, [])

  // Only "system" needs to keep listening.
  useEffect(() => {
    if (choice !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => {
      const next: ResolvedTheme = mq.matches ? "dark" : "light"
      setResolved(next)
      document.documentElement.setAttribute("data-console-theme", next)
    }
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [choice])

  const set = useCallback((next: ThemeChoice) => {
    setChoice(next)
    try { localStorage.setItem(KEY, next) } catch {}
    const r = resolveTheme(next)
    setResolved(r)
    document.documentElement.setAttribute("data-console-theme", r)
  }, [])

  return { choice, resolved, set }
}
