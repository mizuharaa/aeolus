/**
 * Quick sanity check — run this first before heavier benchmarks.
 *
 *   cd aeolus
 *   k6 run benchmarks/k6/smoke.js
 *
 *   k6 run -e BASE_URL=http://localhost:8000 benchmarks/k6/smoke.js
 */
import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

import { API, BASE_URL } from './lib/config.js';

const failRate = new Rate('failed_requests');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    failed_requests: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

function get(path, name) {
  const res = http.get(`${API}${path}`, { tags: { name } });
  const ok = check(res, {
    [`${name} status 200`]: (r) => r.status === 200,
  });
  failRate.add(!ok);
  return res;
}

export default function () {
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
    const ok = check(res, {
      'health status 200': (r) => r.status === 200,
      'health service aeolus-api': (r) => r.json('service') === 'aeolus-api',
    });
    failRate.add(!ok);
  });

  group('read endpoints', () => {
    get('/network', 'network');
    get('/schedule', 'schedule');
    get('/simulator/state', 'simulator_state');
    get('/events/types', 'events_types');
    get('/airports', 'airports');
    get('/flights', 'flights');
  });

  sleep(1);
}
