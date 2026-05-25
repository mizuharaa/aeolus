/**
 * Compute-heavy workflow — disruption → cascade → MILP recovery.
 *
 * Aeolus keeps all simulation state in a single in-memory engine, so this
 * script uses ONE virtual user. Running many VUs against POST /events/trigger
 * or /recovery/solve will race on shared state and produce misleading results.
 *
 * Expect p95 latency in the tens of seconds when OR-Tools runs (solver timeout
 * defaults to 30s in config).
 *
 *   cd aeolus
 *   k6 run benchmarks/k6/compute-workflow.js
 *
 *   k6 run -e SOLVER_ITERATIONS=5 benchmarks/k6/compute-workflow.js
 */
import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import {
  API,
  cascadePredictBody,
  jsonHeaders,
  recoverySolveBody,
  weatherClosureEvent,
} from './lib/config.js';

const failRate = new Rate('failed_requests');
const triggerDuration = new Trend('trigger_duration', true);
const predictDuration = new Trend('predict_duration', true);
const solveDuration = new Trend('solve_duration', true);

const iterations = Number(__ENV.SOLVER_ITERATIONS || 3);

export const options = {
  vus: 1,
  iterations,
  thresholds: {
    failed_requests: ['rate<0.1'],
    http_req_failed: ['rate<0.1'],
    trigger_duration: ['p(95)<45000'],
    predict_duration: ['p(95)<5000'],
    solve_duration: ['p(95)<45000'],
  },
};

function post(path, body = {}, name = path) {
  const res = http.post(`${API}${path}`, JSON.stringify(body), {
    headers: jsonHeaders,
    tags: { name },
    timeout: '120s',
  });
  const ok = check(res, {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  failRate.add(!ok);
  return res;
}

export default function () {
  group('reset simulation', () => {
    const res = post('/simulator/reset', {}, 'simulator_reset');
    check(res, {
      'reset ok': (r) => r.json('status') === 'reset',
    });
  });

  group('trigger disruption', () => {
    const res = post('/events/trigger', weatherClosureEvent, 'events_trigger');
    triggerDuration.add(res.timings.duration);
    check(res, {
      'trigger returned cascade_summary': (r) =>
        r.json('cascade_summary') !== undefined,
      'trigger returned recovery_plans': (r) =>
        Array.isArray(r.json('recovery_plans')),
    });
  });

  group('predict cascade', () => {
    const res = post('/predict/cascade', cascadePredictBody, 'predict_cascade');
    predictDuration.add(res.timings.duration);
    check(res, {
      'predict has summary': (r) => r.json('summary') !== undefined,
    });
  });

  group('solve recovery', () => {
    const res = post('/recovery/solve', recoverySolveBody, 'recovery_solve');
    solveDuration.add(res.timings.duration);
    check(res, {
      'solve returned plans': (r) => Array.isArray(r.json('plans')),
    });
  });

  sleep(1);
}
