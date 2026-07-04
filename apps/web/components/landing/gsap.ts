"use client"
/**
 * Single GSAP entry for the landing — plugins registered once, everything
 * imports from here so ScrollTrigger/SplitText never double-register.
 */
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText)
}

export { gsap, ScrollTrigger, SplitText }
