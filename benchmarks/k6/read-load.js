/**
 * Read-heavy load test — safe at higher concurrency.
 *
 * These GET endpoints do not mutate the in-memory simulation engine.
 * Avoid hammering /flights/live and /live/* — they call external APIs
 * (OpenSky, NWS, FAA) and will rate-limit or skew results.
 *
 * Note: /network re-parses all YAML files on every request, so its p95 is
 * higher than lightweight endpoints. Latency is reported as trends only.
 *
 *   cd aeolus
 *   k6 run benchmarks/k6/read-load.js
 */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import { API } from './lib/config.js';

const failRate = new Rate('failed_requests');
const networkDuration = new Trend('network_duration', true);
const scheduleDuration = new Trend('schedule_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Only fail on real errors — latency SLAs vary by machine (Docker, Windows, CPU load).
    // Read p95 from network_duration / schedule_duration in the summary for CV numbers.
    failed_requests: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
  },
};

const readPaths = [
  { path: '/network', trend: networkDuration, name: 'network' },
  { path: '/schedule', trend: scheduleDuration, name: 'schedule' },
  { path: '/simulator/state', trend: null, name: 'simulator_state' },
  { path: '/events/types', trend: null, name: 'events_types' },
  { path: '/airports', trend: null, name: 'airports' },
  { path: '/aircraft', trend: null, name: 'aircraft' },
  { path: '/crews', trend: null, name: 'crews' },
  { path: '/recovery/plans', trend: null, name: 'recovery_plans' },
];

export default function () {
  for (const { path, trend, name } of readPaths) {
    const res = http.get(`${API}${path}`, { tags: { name } });
    const ok = check(res, {
      [`${name} 200`]: (r) => r.status === 200,
    });
    failRate.add(!ok);
    if (trend) {
      trend.add(res.timings.duration);
    }
  }

  sleep(0.5);
}
