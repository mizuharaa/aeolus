"use client"
/**
 * Aeolus Design System Primitives — Airtable Editorial
 *
 * Every component here is one of the named building blocks in DESIGN.md.
 * Do NOT inline new hex codes anywhere outside lib/design-tokens.ts; if you
 * need a new color it goes in tokens first, then here.
 *
 * No hover states beyond what the Airtable system documents (Default + Active).
 */

import * as React from "react"
import { c, r, sp, ty, ff, sh, type } from "@/lib/design-tokens"

// ─────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────

type ButtonSize = "md" | "sm"
type ButtonBase = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

/** `{component.button-primary}` — near-black ink, white text, 12px radius.
 *  Use sparingly — one per viewport. */
export function ButtonPrimary({ size = "md", leadingIcon, trailingIcon, children, className = "", ...rest }: ButtonBase) {
  return (
    <button
      {...rest}
      className={`btn-primary ${size === "sm" ? "btn-primary--sm" : ""} ${className}`.trim()}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
}

/** `{component.button-secondary}` — canvas + hairline outline. Always pairs
 *  next to a `ButtonPrimary` as the less-committed choice. */
export function ButtonSecondary({ size = "md", leadingIcon, trailingIcon, children, className = "", ...rest }: ButtonBase) {
  return (
    <button
      {...rest}
      className={`btn-secondary ${size === "sm" ? "btn-secondary--sm" : ""} ${className}`.trim()}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
}

/** `{component.button-icon-circular}` — 40×40 circular button with canvas bg
 *  and hairline border, for carousel / share / back affordances. */
export function ButtonIconCircular({
  children, ariaLabel, onClick, size = 40,
}: {
  children: React.ReactNode
  ariaLabel: string
  onClick?: () => void
  size?: number
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: c.canvas,
        border: `1px solid ${c.hairline}`,
        color: c.ink,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 150ms ease",
      }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Cards & containers
// ─────────────────────────────────────────────────────────────────────

/** `{component.signature-coral-card}` / forest / dark — full-bleed brand
 *  voltage cards with white type. 48px internal padding by default. */
export function SignatureCard({
  variant,
  children,
  style,
  padding = sp.xxl,
}: {
  variant: "coral" | "forest" | "dark" | "cream"
  children: React.ReactNode
  style?: React.CSSProperties
  padding?: number
}) {
  const bg =
    variant === "coral"  ? c.signatureCoral  :
    variant === "forest" ? c.signatureForest :
    variant === "cream"  ? c.signatureCream  :
                            c.surfaceDark
  const ink = variant === "cream" ? c.ink : c.onPrimary
  return (
    <section
      style={{
        background: bg,
        color: ink,
        borderRadius: r.lg,
        padding,
        fontFamily: ff.body,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

/** `{component.cream-callout-card}` — soft beige callout surface for stats /
 *  product UI fragments. 24px padding, 10px radius. */
export function CreamCallout({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        background: c.signatureCream,
        color: c.ink,
        borderRadius: r.md,
        padding: sp.lg,
        fontFamily: ff.body,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

/** Content card — white canvas, hairline border. The default body container. */
export function ContentCard({
  children,
  style,
  padding = sp.xl,
  radius = r.md,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  padding?: number
  radius?: number
}) {
  return (
    <div
      style={{
        background: c.canvas,
        border: `1px solid ${c.hairline}`,
        borderRadius: radius,
        padding,
        boxShadow: sh.cardSoft,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** `{component.demo-grid-card}` — used inside multi-card grids. 16px padding,
 *  10px radius. Background optionally overridden to a signature pastel. */
export function DemoGridCard({
  children,
  background = c.canvas,
  style,
}: {
  children: React.ReactNode
  background?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background,
        border: background === c.canvas ? `1px solid ${c.hairline}` : "none",
        borderRadius: r.md,
        padding: sp.md,
        fontFamily: ff.body,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────────────────────────────

/** Centered max-1280px container with 48px horizontal breathing room. */
export function Container({
  children,
  maxWidth = 1280,
  style,
}: {
  children: React.ReactNode
  maxWidth?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        maxWidth,
        margin: "0 auto",
        paddingLeft: sp.xxl,
        paddingRight: sp.xxl,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Section band — 96px top/bottom padding (universal vertical rhythm). */
export function Section({
  children,
  background = c.canvas,
  style,
}: {
  children: React.ReactNode
  background?: string
  style?: React.CSSProperties
}) {
  return (
    <section
      style={{
        background,
        paddingTop: sp.section,
        paddingBottom: sp.section,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────

/** Typed text element using a typography role from tokens. */
export function Type({
  as: Tag = "span",
  role,
  color,
  children,
  style,
  className,
}: {
  as?: keyof React.JSX.IntrinsicElements
  role: keyof typeof ty
  color?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return React.createElement(
    Tag,
    {
      className,
      style: { ...type(role, color), ...style },
    },
    children,
  )
}

/** Eyebrow / uppercase label — used above section titles. */
export function Eyebrow({ children, color = c.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontFamily: ff.body,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Status badge — semantic ops state. Same color = same meaning everywhere.
// ─────────────────────────────────────────────────────────────────────

type StatusKind = "on-time" | "delayed" | "cancelled" | "recovered"

const STATUS_MAP: Record<StatusKind, { ink: string; bg: string; dot: string; label: string }> = {
  "on-time":   { ink: c.statusOnTime.ink,    bg: c.statusOnTime.bg,    dot: c.statusOnTime.dot,    label: "On time" },
  "delayed":   { ink: c.statusDelayed.ink,   bg: c.statusDelayed.bg,   dot: c.statusDelayed.dot,   label: "Delayed" },
  "cancelled": { ink: c.statusCancelled.ink, bg: c.statusCancelled.bg, dot: c.statusCancelled.dot, label: "Cancelled" },
  "recovered": { ink: c.statusRecovered.ink, bg: c.statusRecovered.bg, dot: c.statusRecovered.dot, label: "Recovered" },
}

export function StatusBadge({
  kind,
  count,
  compact = false,
}: {
  kind: StatusKind
  count?: number
  compact?: boolean
}) {
  const s = STATUS_MAP[kind]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: s.bg,
        color: s.ink,
        fontFamily: ff.body,
        fontSize: compact ? 12 : 13,
        fontWeight: 500,
        padding: compact ? "4px 10px" : "6px 12px",
        borderRadius: r.pill,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {count !== undefined && (
        <span style={{ fontFamily: ff.mono, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {count.toLocaleString()}
        </span>
      )}
      <span style={{ letterSpacing: "0.02em" }}>{s.label}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Hairline divider — used between editorial sections / table rows
// ─────────────────────────────────────────────────────────────────────

export function Hairline({ vertical = false, style }: { vertical?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: c.hairline,
        ...(vertical ? { width: 1, height: "100%" } : { height: 1, width: "100%" }),
        ...style,
      }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────
// Stat — uppercase label above a large numeric value (tabular-nums).
// Used in nav strips, FocusOverlay, cream-callout dashboards.
// ─────────────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  hint,
  color = c.ink,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  color?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Eyebrow>{label}</Eyebrow>
      <span
        style={{
          fontFamily: ff.display,
          fontSize: 28,
          fontWeight: 475,
          lineHeight: 1.15,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      {hint && (
        <span style={{ fontFamily: ff.body, fontSize: 13, fontWeight: 400, color: c.muted }}>
          {hint}
        </span>
      )}
    </div>
  )
}
