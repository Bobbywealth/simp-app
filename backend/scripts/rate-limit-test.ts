import loadtest from "loadtest";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

interface RateLimitResult {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  otherErrors: number;
  rateLimitDetected: boolean;
  firstRatelimitAt: number;
}

const TARGET_REQUESTS = 1000;
const DURATION_SEC = 60;
const LOGIN_ENDPOINT = "/auth/login";

const TEST_PAYLOADS = [
  { email: "user1@test.com", password: "password123" },
  { email: "user2@test.com", password: "password123" },
  { email: "user3@test.com", password: "password123" },
  { email: "user4@test.com", password: "password123" },
  { email: "user5@test.com", password: "password123" },
];

function runRateLimitTest(
  concurrency: number,
  totalRequests: number
): Promise<{ result: loadtest.LoadTestResult | null; error: Error | null }> {
  return new Promise((resolve) => {
    loadtest.loadTest(
      {
        url: `${API_BASE_URL}${LOGIN_ENDPOINT}`,
        method: "POST",
        concurrency,
        maxRequests: totalRequests,
        requestGenerator: () => {
          const payload =
            TEST_PAYLOADS[Math.floor(Math.random() * TEST_PAYLOADS.length)];
          return {
            body: JSON.stringify(payload),
            headers: {
              "Content-Type": "application/json",
            },
          };
        },
        headers: {
          "Content-Type": "application/json",
        },
        agentKeepAlive: true,
        requestTimeout: 30000,
      },
      (error, result) => {
        if (error) {
          resolve({ result: null, error });
          return;
        }
        resolve({ result: result as loadtest.LoadTestResult, error: null });
      }
    );
  });
}

async function runRateLimitTestSuite(): Promise<RateLimitResult> {
  console.log(`\n${"=".repeat(70)}`);
  console.log("RATE LIMIT TEST - /auth/login");
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Target Requests: ${TARGET_REQUESTS}+ in ${DURATION_SEC}s`);
  console.log(`Testing: ${LOGIN_ENDPOINT}`);
  console.log(`${"=".repeat(70)}\n`);

  const concurrency = 50;
  let rateLimitedRequests = 0;
  let successfulRequests = 0;
  let otherErrors = 0;
  let rateLimitDetected = false;
  let firstRatelimitAt = 0;
  let totalRequests = 0;

  console.log(`Starting burst test with concurrency ${concurrency}...\n`);

  const { result, error } = await runRateLimitTest(
    concurrency,
    TARGET_REQUESTS
  );

  if (error) {
    console.error(`\n❌ Load test error: ${error.message}`);

    if (error.message.includes("429") || error.message.includes("Too Many")) {
      rateLimitDetected = true;
      console.log("⚠️  Rate limiting appears to be active (429 detected in error)");
    }

    return {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      otherErrors: 0,
      rateLimitDetected,
      firstRatelimitAt: 0,
    };
  }

  if (!result) {
    console.error("No result returned from loadtest");
    return {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      otherErrors: 0,
      rateLimitDetected: false,
      firstRatelimitAt: 0,
    };
  }

  totalRequests = result.totalRequests;

  console.log(`\n${"=".repeat(70)}`);
  console.log("RATE LIMIT TEST RESULTS");
  console.log(`${"=".repeat(70)}`);
  console.log(`Total Requests:      ${result.totalRequests}`);
  console.log(`Total Errors:        ${result.errors}`);
  console.log(`Requests/Second:     ${result.requestsPerSecond.toFixed(2)}`);
  console.log(`Mean Latency:        ${result.meanLatencyMs}ms`);
  console.log(`Max Latency:         ${result.maxLatencyMs}ms`);
  console.log(`p50 Latency:         ${result.percentiles[50]}ms`);
  console.log(`p95 Latency:         ${result.percentiles[95]}ms`);
  console.log(`p99 Latency:         ${result.percentiles[99]}ms`);
  console.log(`${"=".repeat(70)}\n`);

  const responses = result.responses || new Map();
  for (const [statusCode, count] of responses) {
    console.log(`  Status ${statusCode}: ${count} requests`);
    if (statusCode === 429) {
      rateLimitedRequests += count;
      if (!rateLimitDetected) {
        rateLimitDetected = true;
        firstRatelimitAt = totalRequests > 0 ? (rateLimitedRequests / totalRequests) * 100 : 0;
      }
    } else if (statusCode >= 200 && statusCode < 300) {
      successfulRequests += count;
    } else if (statusCode >= 400) {
      otherErrors += count;
    }
  }

  if (rateLimitedRequests > 0) {
    console.log(`\n✅ Rate limiting IS active - ${rateLimitedRequests} requests returned 429`);
    console.log(`   Rate limiting kicked in after approximately ${firstRatelimitAt.toFixed(1)}% of requests`);
  } else {
    console.log(`\n⚠️  No 429 responses detected - rate limiting may NOT be active`);
    console.log(`   Consider increasing request volume or checking limiter configuration`);
  }

  if (successfulRequests > 0) {
    console.log(`   ${successfulRequests} requests succeeded before rate limiting`);
  }

  if (otherErrors > 0) {
    console.log(`   ${otherErrors} requests failed with other errors (non-429)`);
  }

  return {
    totalRequests,
    successfulRequests,
    rateLimitedRequests,
    otherErrors,
    rateLimitDetected,
    firstRatelimitAt,
  };
}

async function main() {
  try {
    console.log("\n🔬 SIMP App - Rate Limit Test Suite");
    console.log(`Started at: ${new Date().toISOString()}`);

    const result = await runRateLimitTestSuite();

    console.log(`\n${"=".repeat(70)}`);
    console.log("FINAL VERDICT");
    console.log(`${"=".repeat(70)}`);
    console.log(`Total Requests:         ${result.totalRequests}`);
    console.log(`Successful (2xx):       ${result.successfulRequests}`);
    console.log(`Rate Limited (429):     ${result.rateLimitedRequests}`);
    console.log(`Other Errors:           ${result.otherErrors}`);
    console.log(`Rate Limiting Active:   ${result.rateLimitDetected ? "✅ YES" : "❌ NO"}`);
    console.log(`${"=".repeat(70)}`);

    if (!result.rateLimitDetected) {
      console.log(`\n⚠️  WARNING: No rate limiting detected!`);
      console.log(`   The /auth/login endpoint may not have rate limiting configured.`);
      console.log(`   Consider adding express-rate-limit middleware for security.`);
    } else {
      console.log(`\n✅ Rate limiting is working correctly on ${LOGIN_ENDPOINT}`);
    }

    console.log(`\nCompleted at: ${new Date().toISOString()}`);
  } catch (error) {
    console.error("❌ Rate limit test failed:", error);
    process.exit(1);
  }
}

main();
