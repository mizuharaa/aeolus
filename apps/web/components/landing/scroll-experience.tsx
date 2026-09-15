"use client"

import { Opening } from "./opening"
import { CinematicSimulatorDemo } from "./demo/cinematic-simulator-demo"
import { RecoveryStory } from "./recovery-story"
import styles from "./landing-experience.module.css"

export function LandingScrollExperience() {
  return (
    <main className={"lp " + styles.experience + " ae-landing-experience olus-landing"}>
      <Opening />
      <CinematicSimulatorDemo />
      <RecoveryStory />
    </main>
  )
}

