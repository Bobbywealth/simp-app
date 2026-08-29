import { performance } from 'node:perf_hooks';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

interface LimitDiscoveryResult {
  endpoint: string;
  method: string;
  exactLimit: number | null;
  windowMs: number;
  tested: number[];
  notes: string;
}

async function makeRequest(
  url: string,
  method: string,
  body?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Headers }> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, headers: response.headers };
}

async function findLimit(
  endpoint: string,
  method: string,
  body?: object,
  headers: Record<string, string> = {}
): Promise<number | null> {
  let count = 1;
  let lastSuccessCount = 0;
  let state: 'success' | 'rate_limited' | 'unknown' = 'unknown';

  console.log(`\n  Discovering limit for ${method} ${endpoint}...`);

  while (true) {
    const testHeaders = { ...headers, 'X-Discovery-Req': `${count}` };
    const result = await makeRequest(endpoint, method, body, testHeaders);

    if (result.status === 200 || result.status === 201) {
      if (state === 'rate_limited') break;
      state = 'success';
      lastSuccessCount = count;
    } else if (result.status === 429) {
      if (state === 'success') {
        console.log(`  Rate limit detected between ${lastSuccessCount} and ${count} requests`);
        return binarySearchLimit(endpoint, method, body, headers, lastSuccessCount, count);
      }
      state = 'rate_limited';
      if (count === 1) {
        console.log(`  Endpoint is already rate limited (1 request blocked)`);
        return null;
      }
    } else if (result.status >= 400 && result.status < 500 && result.status !== 429) {
      if (state === 'success') {
        return lastSuccessCount;
      }
      console.log(`  Got ${result.status}, backing off...`);
      count = Math.max(1, Math.floor(count / 2));
    } else {
      console.log(`  Unexpected status ${result.status}, continuing...`);
    }

    count++;

    if (count > 10000) {
      console.log(`  Reached maximum test count (10000), exiting`);
      return lastSuccessCount || null;
    }

    await new Promise(r => setImmediate(r));
  }

  return lastSuccessCount;
}

async function binarySearchLimit(
  endpoint: string,
  method: string,
  body: object | undefined,
  headers: Record<string, string>,
  low: number,
  high: number
): Promise<number> {
  console.log(`  Binary searching between ${low} and ${high}...`);

  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    const testHeaders = { ...headers, 'X-Binary-Search': `${mid}` };

    await new Promise(r => setTimeout(r, 100));

    const result = await makeRequest(endpoint, method, body, testHeaders);

    if (result.status === 200 || result.status === 201) {
      low = mid;
    } else if (result.status === 429) {
      high = mid;
    } else {
      console.log(`  Unexpected status ${result.status} at count ${mid}`);
      break;
    }
  }

  console.log(`  Exact limit found: ${low} successful requests`);
  return low;
}

async function testWindowBehavior(
  endpoint: string,
  method: string,
  body: object | undefined,
  limit: number
): Promise<void> {
  console.log(`\n  Testing window behavior (expect reset after window expires)...`);

  const userId = `window-test-${Date.now()}`;
  const headers = { 'X-Window-Test': userId };

  let count = 0;
  let found429 = false;

  for (let i = 0; i < limit + 10; i++) {
    const result = await makeRequest(endpoint, method, body, headers);
    count++;

    if (result.status === 429) {
      const retryAfter = result.headers.get('Retry-After');
      console.log(`  Request ${count}: 429 Rate Limited (Retry-After: ${retryAfter ?? 'none'})`);
      found429 = true;
      break;
    }

    await new Promise(r => setImmediate(r));
  }

  if (!found429) {
    console.log(`  WARNING: Did not hit rate limit after ${limit + 10} requests`);
  }
}

async function testIpBasedLimiting(endpoint: string, method: string, body?: object): Promise<void> {
  console.log(`\n  Testing IP-based limiting...`);

  const ip1 = `ip-test-1-${Date.now()}`;
  const ip2 = `ip-test-2-${Date.now()}`;

  for (let i = 0; i < 5; i++) {
    await makeRequest(endpoint, method, body, { 'X-Forwarded-For': ip1 });
    await makeRequest(endpoint, method, body, { 'X-Forwarded-For': ip2 });
    await new Promise(r => setImmediate(r));
  }

  console.log(`  IP-based limiting: Both IPs should have independent counters`);
  console.log(`  (If IP-based is NOT used, both IPs share the same counter)`);
}

async function testUserBasedLimiting(endpoint: string, method: string, body?: object): Promise<void> {
  console.log(`\n  Testing user-based limiting...`);

  const user1 = `user-limit-1-${Date.now()}`;
  const user2 = `user-limit-2-${Date.now()}`;

  console.log(`  Testing with User 1 (${user1})...`);
  let blockedUser1 = false;
  for (let i = 0; i < 10; i++) {
    const result = await makeRequest(endpoint, method, body, { 'Authorization': `Bearer token-${user1}` });
    if (result.status === 429) {
      console.log(`  User 1 blocked after ${i + 1} requests`);
      blockedUser1 = true;
      break;
    }
    await new Promise(r => setImmediate(r));
  }
  if (!blockedUser1) console.log(`  User 1: did not hit limit in 10 requests`);

  console.log(`  Testing with User 2 (${user2})...`);
  let blockedUser2 = false;
  for (let i = 0; i < 10; i++) {
    const result = await makeRequest(endpoint, method, body, { 'Authorization': `Bearer token-${user2}` });
    if (result.status === 429) {
      console.log(`  User 2 blocked after ${i + 1} requests`);
      blockedUser2 = true;
      break;
    }
    await new Promise(r => setImmediate(r));
  }
  if (!blockedUser2) console.log(`  User 2: did not hit limit in 10 requests`);

  console.log(`  If limits are per-user, each user should have independent counters`);
}

async function main() {
  console.log('\n🔍 SIMP App - Rate Limit Discovery Suite');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  const endpoints: Array<{ endpoint: string; method: string; body?: object; windowMs: number; notes: string }> = [
    { endpoint: '/auth/login', method: 'POST', body: { email: 'findlimit@example.com', password: 'test' }, windowMs: 15 * 60_000, notes: 'IP-based' },
    { endpoint: '/swipes', method: 'POST', body: { targetUserId: 'test', direction: 'right' }, windowMs: 60_000, notes: 'User-based' },
    { endpoint: '/messages', method: 'POST', body: { conversationId: 'test', content: 'hi' }, windowMs: 60_000, notes: 'User-based' },
    { endpoint: '/live/streams', method: 'GET', windowMs: 60_000, notes: 'May be IP-based' },
    { endpoint: '/reports', method: 'POST', body: { reason: 'spam', reportedUserId: 'test' }, windowMs: 60 * 60_000, notes: 'IP-based' },
  ];

  const results: LimitDiscoveryResult[] = [];

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${endpoints.length}] Discovering: ${ep.method} ${ep.endpoint}`);
    console.log(`Notes: ${ep.notes}`);
    console.log(`${'='.repeat(60)}`);

    const exactLimit = await findLimit(ep.endpoint, ep.method, ep.body);

    if (exactLimit !== null) {
      await new Promise(r => setTimeout(r, 2000));

      await testWindowBehavior(ep.endpoint, ep.method, ep.body, exactLimit);

      if (ep.endpoint === '/auth/login' || ep.endpoint === '/reports') {
        await testIpBasedLimiting(ep.endpoint, ep.method, ep.body);
      } else {
        await testUserBasedLimiting(ep.endpoint, ep.method, ep.body);
      }
    }

    await new Promise(r => setTimeout(r, 3000));

    results.push({
      endpoint: ep.endpoint,
      method: ep.method,
      exactLimit,
      windowMs: ep.windowMs,
      tested: [],
      notes: ep.notes,
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('DISCOVERY SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n${'Endpoint'.padEnd(25)} ${'Method'.padEnd(10)} ${'Limit'.padEnd(10)} ${'Window'.padEnd(12)} Notes`);
  console.log(`${'-'.repeat(80)}`);

  for (const r of results) {
    const ep = r.endpoint.padEnd(25);
    const method = r.method.padEnd(10);
    const limit = (r.exactLimit ?? '?').toString().padEnd(10);
    const window = r.windowMs >= 3600000 ? `${r.windowMs / 3600000}h` : `${r.windowMs / 60000}m`;
    console.log(`${ep} ${method} ${limit} ${window.padEnd(12)} ${r.notes}`);
  }

  console.log(`\n✅ Discovery completed at ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error('\n❌ Discovery failed:', err);
  process.exit(1);
});
