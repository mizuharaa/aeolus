"use client"

import { type RefObject, useEffect, useState } from "react"

/**
 * Mount an expensive scene once it approaches the viewport. This is a
 * one-time React update; continuous scroll remains in the mutable motion path.
 */
export function useNearViewport<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = "180% 0px",
) {
  const [near, setNear] = useState(false)

  useEffect(() => {
    if (near) return
    const node = ref.current
    if (!node) return

    if (!("IntersectionObserver" in window)) {
      setNear(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [near, ref, rootMargin])

  return near
}
