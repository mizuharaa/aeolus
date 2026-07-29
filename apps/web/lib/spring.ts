import * as THREE from "three"

/**
 * Critically damped scalar spring.
 *
 * The integrator clamps long frames so a tab restore or debugger pause cannot
 * inject a large impulse. Values therefore settle the same way at 60 Hz,
 * 120 Hz, and during ordinary dropped frames.
 */
export class Spring {
  value: number
  velocity = 0

  constructor(
    public stiffness = 120,
    public damping = 2 * Math.sqrt(stiffness),
    initialValue = 0,
  ) {
    this.value = initialValue
  }

  step(target: number, delta: number) {
    const dt = Math.min(Math.max(delta, 0), 1 / 30)
    const acceleration =
      -this.stiffness * (this.value - target) - this.damping * this.velocity
    this.velocity += acceleration * dt
    this.value += this.velocity * dt
    return this.value
  }

  snap(value: number) {
    this.value = value
    this.velocity = 0
    return this.value
  }
}

export const damp = (
  current: number,
  target: number,
  lambda: number,
  delta: number,
) => THREE.MathUtils.damp(current, target, lambda, Math.min(delta, 1 / 30))
