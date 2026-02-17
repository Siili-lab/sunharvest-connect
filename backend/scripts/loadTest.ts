/**
 * Performance & Load Test
 *
 * Run: npx ts-node scripts/loadTest.ts
 *
 * Tests:
 * 1. Response time benchmarks for key endpoints
 * 2. Concurrent request handling
 * 3. Rate limiter verification
 * 4. Payload size limits
 *
 * Requires the backend to be running on localhost:3000
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;

interface BenchResult {
  endpoint: string;
  method: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  successRate: number;
  requests: number;
}

let farmerToken = '';
let buyerToken = '';

async function setup(): Promise<void> {
  // Check backend is running
  try {
    await axios.get(`${BASE_URL}/health`);
  } catch {
    console.log(`ERROR: Backend not running on ${BASE_URL}`);
    process.exit(1);
  }

  // Login
  const [farmer, buyer] = await Promise.all([
    axios.post(`${API}/auth/login`, { phone: '+254712345678', pin: '1234' }),
    axios.post(`${API}/auth/login`, { phone: '+254723456789', pin: '1234' }),
  ]);
  farmerToken = farmer.data.data.token;
  buyerToken = buyer.data.data.token;
}

async function benchmark(
  name: string,
  method: 'GET' | 'POST',
  url: string,
  iterations: number,
  options?: { headers?: Record<string, string>; data?: any },
): Promise<BenchResult> {
  const times: number[] = [];
  let successes = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      if (method === 'GET') {
        await axios.get(url, { headers: options?.headers, timeout: 10000 });
      } else {
        await axios.post(url, options?.data, { headers: options?.headers, timeout: 10000 });
      }
      successes++;
    } catch (err: any) {
      // 429 (rate limited) still counts as "handled"
      if (err.response?.status === 429) {
        successes++;
      }
    }
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p95idx = Math.floor(times.length * 0.95);

  return {
    endpoint: name,
    method,
    avgMs: Math.round(avg),
    minMs: Math.round(times[0]),
    maxMs: Math.round(times[times.length - 1]),
    p95Ms: Math.round(times[p95idx]),
    successRate: successes / iterations,
    requests: iterations,
  };
}

async function concurrentLoad(
  name: string,
  method: 'GET' | 'POST',
  url: string,
  concurrency: number,
  options?: { headers?: Record<string, string>; data?: any },
): Promise<{ successes: number; failures: number; avgMs: number; totalMs: number }> {
  const start = performance.now();
  const promises = [];

  for (let i = 0; i < concurrency; i++) {
    const p = (async () => {
      try {
        if (method === 'GET') {
          await axios.get(url, { headers: options?.headers, timeout: 15000 });
        } else {
          await axios.post(url, options?.data, { headers: options?.headers, timeout: 15000 });
        }
        return true;
      } catch {
        return false;
      }
    })();
    promises.push(p);
  }

  const results = await Promise.all(promises);
  const totalMs = performance.now() - start;
  const successes = results.filter(Boolean).length;

  return {
    successes,
    failures: concurrency - successes,
    avgMs: Math.round(totalMs / concurrency),
    totalMs: Math.round(totalMs),
  };
}

async function run() {
  console.log('=== SunHarvest Connect Performance & Load Test ===\n');

  await setup();
  console.log('Setup complete. Running benchmarks...\n');

  const authHeaders = { Authorization: `Bearer ${farmerToken}` };

  // ── Test 1: Response Time Benchmarks ──
  console.log('1. RESPONSE TIME BENCHMARKS (20 iterations each)');
  console.log('-'.repeat(80));

  const benchmarks: BenchResult[] = [];
  const N = 20;

  benchmarks.push(await benchmark('Health check', 'GET', `${BASE_URL}/health`, N));
  benchmarks.push(await benchmark('Listings (public)', 'GET', `${API}/produce/listings?limit=10`, N));
  benchmarks.push(await benchmark('Listings (filtered)', 'GET', `${API}/produce/listings?crop=tomato&county=Kiambu&limit=5`, N));
  benchmarks.push(await benchmark('Market trends', 'GET', `${API}/market/trends?crop=tomato`, N, { headers: authHeaders }));
  benchmarks.push(await benchmark('Market intelligence', 'GET', `${API}/market/intelligence`, N, { headers: authHeaders }));
  benchmarks.push(await benchmark('SMS parse', 'GET', `${API}/sms/test?message=bei%20nyanya`, N));
  benchmarks.push(await benchmark('Price prediction', 'POST', `${API}/market/predict-price`, N, {
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    data: { crop: 'tomato', grade: 'Grade A', quantity: 100, county: 'Kiambu' },
  }));
  benchmarks.push(await benchmark('Auth login', 'POST', `${API}/auth/login`, 5, {
    headers: { 'Content-Type': 'application/json' },
    data: { phone: '+254712345678', pin: '1234' },
  }));

  const pad = (s: string, len: number) => s.length >= len ? s : ' '.repeat(len - s.length) + s;
  const padR = (s: string, len: number) => s.length >= len ? s : s + ' '.repeat(len - s.length);

  console.log(`\n  ${padR('Endpoint', 25)} ${pad('Avg', 8)} ${pad('Min', 8)} ${pad('Max', 8)} ${pad('P95', 8)} ${pad('Success', 8)}`);
  console.log('  ' + '-'.repeat(70));
  for (const b of benchmarks) {
    const status = b.avgMs < 200 ? 'FAST' : b.avgMs < 500 ? 'OK' : b.avgMs < 1000 ? 'SLOW' : 'CRITICAL';
    console.log(`  ${padR(b.endpoint, 25)} ${pad(b.avgMs + 'ms', 8)} ${pad(b.minMs + 'ms', 8)} ${pad(b.maxMs + 'ms', 8)} ${pad(b.p95Ms + 'ms', 8)} ${pad((b.successRate * 100).toFixed(0) + '%', 8)}  ${status}`);
  }

  // ── Test 2: Concurrent Request Handling ──
  console.log('\n2. CONCURRENT REQUEST HANDLING');
  console.log('-'.repeat(80));

  const concurrencyLevels = [10, 25, 50];
  for (const c of concurrencyLevels) {
    const result = await concurrentLoad(
      'Listings',
      'GET',
      `${API}/produce/listings?limit=5`,
      c,
    );
    console.log(`  ${c} concurrent requests: ${result.successes}/${c} success, avg ${result.avgMs}ms, total ${result.totalMs}ms`);
  }

  // Auth endpoint concurrent
  for (const c of [5, 10]) {
    const result = await concurrentLoad(
      'Auth login',
      'POST',
      `${API}/auth/login`,
      c,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { phone: '+254712345678', pin: '1234' },
      },
    );
    console.log(`  ${c} concurrent auth: ${result.successes}/${c} success, avg ${result.avgMs}ms`);
  }

  // ── Test 3: Rate Limiter Verification ──
  console.log('\n3. RATE LIMITER VERIFICATION');
  console.log('-'.repeat(80));

  // Auth limiter: 5 requests per 15 min
  // Rapid-fire 8 auth requests — at least some should get 429
  let rateLimited = 0;
  let authSuccesses = 0;
  for (let i = 0; i < 8; i++) {
    try {
      await axios.post(`${API}/auth/login`, { phone: '+254712345678', pin: '1234' });
      authSuccesses++;
    } catch (err: any) {
      if (err.response?.status === 429) rateLimited++;
    }
  }
  const authRateLimitWorks = rateLimited > 0;
  console.log(`  Auth rate limiter: ${authRateLimitWorks ? 'ACTIVE' : 'NOT TRIGGERED'} (${authSuccesses} ok, ${rateLimited} rate-limited in 8 rapid requests)`);

  // ── Test 4: Payload Size Limits ──
  console.log('\n4. PAYLOAD SIZE LIMITS');
  console.log('-'.repeat(80));

  // Test JSON body limit (10mb set in app.ts)
  try {
    const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB
    await axios.post(`${API}/auth/login`, largePayload);
    console.log('  Large JSON payload (11MB): ACCEPTED (should be rejected!)');
  } catch (err: any) {
    const status = err.response?.status || 'network error';
    console.log(`  Large JSON payload (11MB): REJECTED (status ${status}) - GOOD`);
  }

  // Test image upload limit (5MB in multer)
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    const bigImage = Buffer.alloc(6 * 1024 * 1024, 0xFF); // 6MB
    form.append('image', bigImage, { filename: 'big.jpg', contentType: 'image/jpeg' });
    form.append('cropType', 'tomato');
    await axios.post(`${API}/produce/grade`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${farmerToken}` },
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    });
    console.log('  Large image upload (6MB): ACCEPTED (should be rejected!)');
  } catch (err: any) {
    const status = err.response?.status || 'network error';
    console.log(`  Large image upload (6MB): REJECTED (status ${status}) - GOOD`);
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log('PERFORMANCE SUMMARY');
  console.log('='.repeat(60));

  const avgAll = benchmarks.reduce((s, b) => s + b.avgMs, 0) / benchmarks.length;
  const slowEndpoints = benchmarks.filter(b => b.avgMs > 500);

  console.log(`\n  Average response time: ${Math.round(avgAll)}ms`);
  console.log(`  Auth rate limiter: ${authRateLimitWorks ? 'WORKING' : 'NEEDS ATTENTION'}`);
  console.log(`  Slow endpoints (>500ms): ${slowEndpoints.length === 0 ? 'None' : slowEndpoints.map(b => b.endpoint).join(', ')}`);

  if (slowEndpoints.length === 0 && authRateLimitWorks) {
    console.log('\n  RESULT: PASS');
  } else {
    console.log('\n  RESULT: ISSUES FOUND');
    if (slowEndpoints.length > 0) {
      console.log('  - Optimize slow endpoints');
    }
    if (!authRateLimitWorks) {
      console.log('  - Auth rate limiter may not be configured correctly');
    }
  }

  console.log('');
}

run().catch((err) => {
  console.error('Load test error:', err.message);
  process.exit(1);
});
