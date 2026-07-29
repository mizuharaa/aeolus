"use client"

/**
 * Scroll room for the cabin-to-airframe handoff. The actual imagery remains
 * in fixed WebGL layers so the camera can cross the cabin wall without a DOM
 * cut. Once the aircraft reaches its full three-quarter view, HeroPlane3D
 * owns the short, one-time Q-flight and hands focus to the restored Aeolus
 * identity stage before the network view begins.
 */
export function FlightIntroStage() {
  return (
    <section id="flight-intro" className="ae-flight-intro" aria-label="From cabin to airframe">
      <h1 className="ae-sr-only">Airline recovery starts inside the aircraft and reaches the whole network.</h1>
      <div className="ae-flight-cue" aria-hidden>
        <span>Cabin</span>
        <i />
        <span>Airframe</span>
        <i />
        <span>Network</span>
      </div>
    </section>
  )
}
