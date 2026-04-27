import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? "-" : "+"
  if (h === 0) return `${sign}${m}m`
  return `${sign}${h}h ${m}m`
}

export function formatUSD(cents: number): string {
  if (cents >= 1_000_000) return `$${(cents / 1_000_000).toFixed(1)}M`
  if (cents >= 1_000) return `$${(cents / 1_000).toFixed(0)}K`
  return `$${cents}`
}
