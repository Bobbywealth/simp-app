import { performance } from 'node:perf_hooks';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

interface RateLimitConfig {
  endpoint: string;
  method: string;
  limit: number;
  windowMs: number;
  body?: object;
}

interface TestResult {
  endpoint: string;
  limit: number;
  windowMs: number;
  requestsSent: number;
  success200: number;
  rateLimited429: number;
  otherErrors: number;
  first429Index: number | null;
  requestsBeforeBlock: number;
  avgLatencyMs: number;
  retryAfterHeader: string | null;
}

interface VirtualUser {
  id: number;
  headers: Record<string, string>;
}

const RATE_LIMIT_CONFIGS: RateLimitConfig[] = [
  { endpoint: '/auth/login', method: 'POST', limit: 10, windowMs: 15 * 60_000, body: { email: 'test@example.com', password: 'wrong' } },
  { endpoint: '/swipes', method: 'POST', limit: 60, windowMs: 60_000, body: { targetUserId: 'test-user-1', direction: 'right' } },
  { endpoint: '/messages', method: 'POST', limit: 120, windowMs: 60_000, body: { conversationId: 'test-conv', content: 'test' } },
  { endpoint: '/live/streams', method: 'GET', limit: 60, windowMs: 60_000 },
  { endpoint: '/reports', method: 'POST', limit: 10, windowMs: 60 * 60_000, body: { reason: 'spam', reportedUserId: 'test-user' } },
];

function formatWindow(ms: number): string {
  if (ms >= 60 * 60_000) return `${ms / (60 * 60_000)}h`;
  if (ms >= 60_000) return `${ms / 60_000}m`;
  return `${ms / 1000}s`;
}

async function makeRequest(
  url: string,
  method: string,
  body?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Headers; latencyMs: number }> {
  const start = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = performance.now() - start;
    return { status: response.status, headers: response.headers, latencyMs };
  } catch (err) {
    const latencyMs = performance.now() - start;
    throw Object.assign(err, { latencyMs });
  }
}

async function runStressTest(config: RateLimitConfig, numVirtualUsers: number): Promise<TestResult> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STRESS TEST: ${config.method} ${config.endpoint}`);
  console.log(`Limit: ${config.limit} req / ${formatWindow(config.windowMs)}`);
  console.log(`Virtual Users: ${numVirtualUsers}`);
  console.log(`${'─'.repeat(60)}`);

  const virtualUsers: VirtualUser[] = Array.from({ length: numVirtualUsers }, (_, i) => ({
    id: i,
    headers: { 'X-Virtual-User-Id': `stress-user-${i}` },
  }));

  let requestsSent = 0;
  let success200 = 0;
  let rateLimited429 = 0;
  let otherErrors = 0;
  let first429Index: number | null = null;
  let totalLatency = 0;
  let retryAfterHeader: string | null = null;

  const requests: Promise<void>[] = [];

  for (let i = 0; i < config.limit * 2; i++) {
    const user = virtualUsers[i % numVirtualUsers];
    const requestPromise = (async () => {
      try {
        const result = await makeRequest(
          config.endpoint,
          config.method,
          config.body,
          user.headers
        );
        requestsSent++;
        totalLatency += result.latencyMs;

        if (result.status === 200 || result.status === 201) {
          success200++;
        } else if (result.status === 429) {
          rateLimited429++;
          if (first429Index === null) {
            first429Index = requestsSent;
            retryAfterHeader = result.headers.get('Retry-After');
          }
        } else {
          otherErrors++;
        }
      } catch (err) {
        requestsSent++;
        const error = err as { code?: string; message?: string };
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'FETCH_ERROR') {
          otherErrors++;
        } else {
          otherErrors++;
        }
      }
    })();
    requests.push(requestPromise);

    if (i < config.limit * 2 - 1) {
      await new Promise(r => setImmediate(r));
    }
  }

  await Promise.all(requests);

  const result: TestResult = {
    endpoint: config.endpoint,
    limit: config.limit,
    windowMs: config.windowMs,
    requestsSent,
    success200,
    rateLimited429,
    otherErrors,
    first429Index,
    requestsBeforeBlock: first429Index ?? config.limit,
    avgLatencyMs: requestsSent > 0 ? totalLatency / requestsSent : 0,
    retryAfterHeader,
  };

  console.log(`\nResults for ${config.endpoint}:`);
  console.log(`  Requests Sent:      ${result.requestsSent}`);
  console.log(`  200 Responses:      ${result.success200}`);
  console.log(`  429 Rate Limited:   ${result.rateLimited429}`);
  console.log(`  Other Errors:       ${result.otherErrors}`);
  console.log(`  First 429 at req#:  ${result.first429Index ?? 'N/A'}`);
  console.log(`  Requests Before Block: ${result.requestsBeforeBlock}`);
  console.log(`  Avg Latency:        ${result.avgLatencyMs.toFixed(2)}ms`);
  console.log(`  Retry-After Header: ${result.retryAfterHeader ?? 'N/A'}`);

  return result;
}

async function runVirtualUserSimulation(config: RateLimitConfig): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VIRTUAL USER SIMULATION: ${config.method} ${config.endpoint}`);
  console.log(`${'='.repeat(60)}`);

  const numVirtualUsers = 3;
  const requestsPerUser = Math.ceil((config.limit * 2) / numVirtualUsers);

  console.log(`Simulating ${numVirtualUsers} virtual users, ${requestsPerUser} requests each`);

  for (let u = 0; u < numVirtualUsers; u++) {
    const userId = `vu-${u}-${Date.now()}`;
    console.log(`\n  Virtual User ${u + 1} (${userId}):`);

    for (let r = 0; r < requestsPerUser; r++) {
      const result = await makeRequest(
        config.endpoint,
        config.method,
        config.body,
        { 'X-Virtual-User-Id': userId }
      );

      if (result.status === 429) {
        const retryAfter = result.headers.get('Retry-After');
        console.log(`    Request ${r + 1}: 429 Rate Limited (Retry-After: ${retryAfter ?? 'none'})`);
        break;
      } else if (result.status === 200 || result.status === 201) {
        console.log(`    Request ${r + 1}: ${result.status} OK`);
      } else {
        console.log(`    Request ${r + 1}: ${result.status}`);
      }

      await new Promise(r => setImmediate(r));
    }
  }
}

async function verifyHeaders(config: RateLimitConfig): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`HEADER VERIFICATION: ${config.method} ${config.endpoint}`);
  console.log(`${'─'.repeat(60)}`);

  const userId = `header-test-${Date.now()}`;
  let found429 = false;

  for (let i = 0; i < config.limit + 5; i++) {
    const result = await makeRequest(
      config.endpoint,
      config.method,
      config.body,
      { 'X-Virtual-User-Id': userId }
    );

    if (result.status === 429 && !found429) {
      found429 = true;
      const hasStandardHeaders = result.headers.has('Retry-After');
      const hasRateLimitHeader = result.headers.has('X-RateLimit-Limit') || 
                                  result.headers.has('RateLimit-Limit') ||
                                  result.headers.has('Rate-Limit-Limit');

      console.log(`  Status: 429 (Expected)`);
      console.log(`  Retry-After Header: ${result.headers.get('Retry-After') ?? 'MISSING'}`);
      console.log(`  RateLimit-Limit Header: ${result.headers.get('X-RateLimit-Limit') ?? result.headers.get('RateLimit-Limit') ?? 'MISSING'}`);
      console.log(`  RateLimit-Remaining Header: ${result.headers.get('X-RateLimit-Remaining') ?? result.headers.get('RateLimit-Remaining') ?? 'MISSING'}`);
      console.log(`  RateLimit-Reset Header: ${result.headers.get('X-RateLimit-Reset') ?? result.headers.get('RateLimit-Reset') ?? 'MISSING'}`);
      break;
    }

    await new Promise(r => setImmediate(r));
  }

  if (!found429) {
    console.log(`  WARNING: Did not hit rate limit to verify headers`);
  }
}

async function main() {
  console.log('\n🚀 SIMP App - Rate Limiting Stress Test Suite');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  const allResults: TestResult[] = [];

  for (let i = 0; i < RATE_LIMIT_CONFIGS.length; i++) {
    const config = RATE_LIMIT_CONFIGS[i];
    
    console.log(`\n[${i + 1}/${RATE_LIMIT_CONFIGS.length}] Testing ${config.endpoint}`);
    
    const result = await runStressTest(config, 1);
    allResults.push(result);

    await new Promise(r => setTimeout(r, 2000));

    await runVirtualUserSimulation(config);

    await new Promise(r => setTimeout(r, 1000));

    await verifyHeaders(config);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n${'Endpoint'.padEnd(25)} ${'Limit'.padEnd(10)} ${'Sent'.padEnd(8)} ${'200'.padEnd(8)} ${'429'.padEnd(8)} ${'Before Block'}`);
  console.log(`${'-'.repeat(80)}`);

  for (const r of allResults) {
    const endpoint = `${r.endpoint}`.padEnd(25);
    const limit = `${r.limit}`.padEnd(10);
    const sent = `${r.requestsSent}`.padEnd(8);
    const ok = `${r.success200}`.padEnd(8);
    const rl = `${r.rateLimited429}`.padEnd(8);
    const before = `${r.requestsBeforeBlock}`;
    console.log(`${endpoint} ${limit} ${sent} ${ok} ${rl} ${before}`);
  }

  console.log(`\n✅ Stress test completed at ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error('\n❌ Stress test failed:', err);
  process.exit(1);
});
