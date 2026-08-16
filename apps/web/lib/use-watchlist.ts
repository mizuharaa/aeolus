"use client"
/**
 * The operator's watchlist, shared.
 *
 * The list already existed — `my-flights.tsx` has kept it in
 * `localStorage["aeolus-watched-flights"]` since before the console rebuild —
 * but it was PRIVATE to that component, which is why the bookmark button on the
 * flight detail panel was a dead control: there was nowhere for it to write.
 *
 * Two subscribers of the same localStorage key would also desync, because
 * `storage` events do not fire in the tab that made the write. So this module
 * owns one module-level list and notifies every subscriber directly, and syncs
 * ACROSS tabs via the storage event on top of that.
 */

import { useCallback, useSyncExternalStore } from "react"

const KEY = "aeolus-watched-flights"

let ids: string[] = []
let hydrated = false
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []
  } catch {
    return []
  }
}

function emit() {
  for (const l of listeners) l()
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  ids = read()
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return
    ids = read()
    emit()
  })
}

function subscribe(listener: () => void) {
  hydrate()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// Identity-stable snapshots. useSyncExternalStore re-renders whenever the
// snapshot is not Object.is-equal to the last one, so returning a fresh array
// here would loop forever.
const getSnapshot = () => ids
const EMPTY: string[] = []
const getServerSnapshot = () => EMPTY

function write(next: string[]) {
  ids = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  emit()
}

export function useWatchlist() {
  const watched = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const add = useCallback((id: string) => {
    if (ids.includes(id)) return
    write([...ids, id])
  }, [])

  const remove = useCallback((id: string) => {
    if (!ids.includes(id)) return
    write(ids.filter((v) => v !== id))
  }, [])

  const toggle = useCallback((id: string) => {
    write(ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id])
  }, [])

  const has = useCallback((id: string) => watched.includes(id), [watched])

  return { watched, add, remove, toggle, has }
}
