/**
 * Shared k6 config for Aeolus benchmarks.
 *
 * Override at runtime:
 *   k6 run -e BASE_URL=http://localhost:8000 benchmarks/k6/smoke.js
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
export const API = `${BASE_URL}/api/v1`;

export const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export const weatherClosureEvent = {
  kind: 'weather_closure',
  params: { airport: 'KORD', severity: 'severe', duration_hours: 4 },
};

export const cascadePredictBody = {
  event: {
    kind: 'weather_closure',
    params: { airport: 'KORD', severity: 'severe', duration_hours: 4 },
  },
};

export const recoverySolveBody = {
  event_ids: [],
  disrupted_flight_ids: [],
};

export const stressTestBody = {
  airports: ['KORD', 'KATL'],
  event_kinds: ['weather_closure', 'ground_stop'],
  iterations_per_airport: 2,
  seed: 42,
};
