/**
 * Ask-Aeolus copilot — rate-limiter benchmark.
 *
 * Hammers POST /agent/ask with concurrent VUs and verifies the app-level
 * token bucket (10/min, burst 4 per IP) does its job:
 *
 *   - a small number of requests reach Gemini and return 200 (slow, ~2-6s)
 *   - everything past the bucket is rejected 429 FAST (the whole point:
 *     rejects must be cheap so a flood can't run up the upstream bill)
 *   - nothing 5xxs
 *
 *   k6 run benchmarks/k6/agent-ratelimit.js
 *   k6 run -e BASE_URL=http://localhost:8000 benchmarks/k6/agent-ratelimit.js
 */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

import { API } from './lib/config.js';

// 429 is the EXPECTED outcome under flood — don't let k6 count it as a
// failed request (only real transport errors / 5xx should fail).
http.setResponseCallback(http.expectedStatuses(200, 429));

const limited = new Rate('rate_limited');           // share of 429s
const rejectLatency = new Trend('reject_latency_ms', true); // how fast a 429 returns
const upstreamCalls = new Counter('upstream_200s'); // how many hit Gemini

export const options = {
  scenarios: {
    flood: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    // 429s must be near-instant — that's what protects the upstream quota
    reject_latency_ms: ['p(95)<50'],
    // no server errors under flood
    http_req_failed: ['rate<0.01'], // 4xx are not "failed" in k6 unless we say so
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.post(
    `${API}/agent/ask`,
    JSON.stringify({ question: 'one word: status?' }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '45s' },
  );

  check(res, {
    'status is 200 or 429 (never 5xx)': (r) => r.status === 200 || r.status === 429,
    '429 carries Retry-After': (r) => r.status !== 429 || r.headers['Retry-After'] !== undefined,
  });

  limited.add(res.status === 429);
  if (res.status === 429) rejectLatency.add(res.timings.duration);
  if (res.status === 200) upstreamCalls.add(1);

  sleep(0.3);
}
