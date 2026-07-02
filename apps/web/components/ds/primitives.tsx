"use client"
/**
 * Aeolus Design System Primitives — five-pigment system.
 *
 * Do NOT inline new hex codes anywhere outside lib/design-tokens.ts /
 * globals.css; if you need a new color it goes in tokens first, then here.
 *
 * Register-aware: every surface/text role is a CSS variable, so the same
 * primitive renders correctly on the light landing register and inside
 * the simulator's `.register-dark` scope.
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

/** Primary CTA — ink on the light register, teal on the dark register.
 *  One per viewport. */
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

/** Secondary CTA — transparent + hairline. Pairs next to a ButtonPrimary. */
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

/** 40×40 circular icon button — carousel / share / back affordances. */
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

/** Feature card — always the ink surface, regardless of the old variant
 *  name. The pastel signature-card family is retired; `variant` now only
 *  chooses between the ink card ("coral"/"forest"/"dark") and the raised
 *  neutral surface ("cream"). */
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
  const isCream = variant === "cream"
  return (
    <section
      style={{
        background: isCream ? c.surfaceSoft : c.surfaceDark,
        color: isCream ? c.ink : "#ECEEE9",
        border: isCream ? `1px solid ${c.hairline}` : "1px solid rgba(245,245,240,0.08)",
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

/** Soft recessed callout surface for stats / product UI fragments. */
export function CreamCallout({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        background: c.surfaceSoft,
        color: c.ink,
        border: `1px solid ${c.hairline}`,
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

/** Content card — register surface, hairline border. The default container. */
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

/** Card used inside multi-card grids. 16px padding, 10px radius. */
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
        border: `1px solid ${c.hairline}`,
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

/** Centered max-1200px container with 48px horizontal breathing room. */
export function Container({
  children,
  maxWidth = 1200,
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

/** Section band — generous vertical rhythm between landing sections. */
export function Section({
  children,
  background = "transparent",
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

/** Eyebrow — the ONE sanctioned uppercase style. 11px, wide tracking,
 *  muted. Use at most once or twice per screen. */
export function Eyebrow({ children, color = c.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontFamily: ff.body,
        fontSize: 11,
        fontWeight: 550,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Status badge — pigment dot + neutral text. Color marks the dot, text
// wears text tokens (never the series color). Same color = same meaning.
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
  /** Tinted background — reserve for the applied-plan hero moment. */
  tinted = false,
}: {
  kind: StatusKind
  count?: number
  compact?: boolean
  tinted?: boolean
}) {
  const s = STATUS_MAP[kind]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: tinted ? s.bg : "transparent",
        color: c.body,
        border: tinted ? "1px solid transparent" : `1px solid ${c.hairline}`,
        fontFamily: ff.body,
        fontSize: compact ? 12 : 13,
        fontWeight: 500,
        padding: compact ? "3px 9px" : "5px 11px",
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
        <span style={{ fontFamily: ff.mono, fontWeight: 550, fontVariantNumeric: "tabular-nums", color: c.ink }}>
          {count.toLocaleString()}
        </span>
      )}
      <span>{s.label}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Hairline divider
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
// Stat — eyebrow label above a large numeric value (tabular-nums).
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
          fontWeight: 550,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      {hint && (
        <span style={{ fontFamily: ff.body, fontSize: 12.5, fontWeight: 400, color: c.muted }}>
          {hint}
        </span>
      )}
    </div>
  )
}
