/**
 * Benchmark POST /network/stress-test — Monte-Carlo vulnerability sweep.
 *
 * CPU-heavy, read-only on simulation state (does not mutate the engine).
 * Safe with low concurrency; scale VUs slowly.
 *
 *   cd aeolus
 *   k6 run benchmarks/k6/network-stress.js
 */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import { API, jsonHeaders, stressTestBody } from './lib/config.js';

const failRate = new Rate('failed_requests');
const stressDuration = new Trend('stress_test_duration', true);

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    failed_requests: ['rate<0.1'],
    stress_test_duration: ['p(95)<60000'],
  },
};

export default function () {
  const res = http.post(`${API}/network/stress-test`, JSON.stringify(stressTestBody), {
    headers: jsonHeaders,
    tags: { name: 'network_stress_test' },
    timeout: '120s',
  });

  const ok = check(res, {
    'stress test 200': (r) => r.status === 200,
    'stress test has ranked results': (r) => Array.isArray(r.json('ranked')),
  });
  failRate.add(!ok);
  stressDuration.add(res.timings.duration);

  sleep(2);
}
