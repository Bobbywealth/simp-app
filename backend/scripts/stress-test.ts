import loadtest from "loadtest";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

interface StressTestResult {
  concurrency: number;
  totalRequests: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
  errorsStarted: boolean;
}

interface EndpointTest {
  name: string;
  path: string;
  method: string;
  body?: object;
}

const ENDPOINTS: EndpointTest[] = [
  { name: "Discovery", path: "/discovery", method: "GET" },
  { name: "Messaging", path: "/messages", method: "GET" },
  { name: "Auth", path: "/auth/me", method: "GET" },
];

const INITIAL_CONCURRENCY = 10;
const CONCURRENCY_STEP = 10;
const STEP_INTERVAL_SEC = 10;
const MAX_CONCURRENCY = 200;
const REQUESTS_PER_STEP = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runStressLoad(
  endpoint: string,
  method: string,
  concurrency: number,
  maxRequests: number,
  body?: object
): Promise<loadtest.LoadTestResult> {
  return new Promise((resolve, reject) => {
    const requestGenerator = body
      ? () => body
      : undefined;

    loadtest.loadTest(
      {
        url: `${API_BASE_URL}${endpoint}`,
        method,
        concurrency,
        maxRequests,
        requestGenerator: requestGenerator
          ? (reqOptions: any) => {
              reqOptions.body = JSON.stringify(requestGenerator());
              reqOptions.headers = {
                "Content-Type": "application/json",
                ...reqOptions.headers,
              };
              return reqOptions;
            }
          : undefined,
        headers: {
          "Content-Type": "application/json",
        },
        agentKeepAlive: true,
        requestTimeout: 30000,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result as loadtest.LoadTestResult);
      }
    );
  });
}

async function runStressTest(): Promise<void> {
  console.log(`\n${"=".repeat(70)}`);
  console.log("STRESS TEST - Ramping Concurrency");
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Initial Concurrency: ${INITIAL_CONCURRENCY}`);
  console.log(`Step: +${CONCURRENCY_STEP} every ${STEP_INTERVAL_SEC}s`);
  console.log(`Max Concurrency: ${MAX_CONCURRENCY}`);
  console.log(`Requests per step: ${REQUESTS_PER_STEP}`);
  console.log(`${"=".repeat(70)}\n`);

  const results: Map<string, StressTestResult[]> = new Map();

  for (const endpoint of ENDPOINTS) {
    console.log(`\n${"-".repeat(70)}`);
    console.log(`Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    console.log(`${"-".repeat(70)}`);

    const endpointResults: StressTestResult[] = [];
    let concurrency = INITIAL_CONCURRENCY;
    let errorsStarted = false;
    let errorsStartedAt = 0;

    while (concurrency <= MAX_CONCURRENCY) {
      console.log(
        `\n  [Step] Concurrency: ${concurrency} | Requests: ${REQUESTS_PER_STEP}`
      );

      try {
        const result = await runStressLoad(
          endpoint.path,
          endpoint.method,
          concurrency,
          REQUESTS_PER_STEP,
          undefined
        );

        const errorRate =
          result.totalRequests > 0
            ? (result.errors / result.totalRequests) * 100
            : 0;

        if (result.errors > 0 && !errorsStarted) {
          errorsStarted = true;
          errorsStartedAt = concurrency;
          console.log(
            `  ⚠️  ERRORS STARTED at ${concurrency} concurrent users!`
          );
        }

        const stressResult: StressTestResult = {
          concurrency,
          totalRequests: result.totalRequests,
          errors: result.errors,
          errorRate,
          p50: result.percentiles[50],
          p95: result.percentiles[95],
          p99: result.percentiles[99],
          rps: result.requestsPerSecond,
          errorsStarted,
        };

        endpointResults.push(stressResult);

        console.log(
          `  Results: RPS=${result.requestsPerSecond.toFixed(2)} | ` +
            `p50=${result.percentiles[50]}ms | p95=${result.percentiles[95]}ms | ` +
            `p99=${result.percentiles[99]}ms | Errors=${result.errors}`
        );
      } catch (error: any) {
        console.error(`  ❌ Error during load test: ${error.message}`);
        if (!errorsStarted) {
          errorsStarted = true;
          errorsStartedAt = concurrency;
        }
      }

      concurrency += CONCURRENCY_STEP;
      if (concurrency <= MAX_CONCURRENCY) {
        console.log(`  Waiting ${STEP_INTERVAL_SEC}s before next step...`);
        await sleep(STEP_INTERVAL_SEC * 1000);
      }
    }

    results.set(endpoint.name, endpointResults);

    console.log(`\n${"-".repeat(70)}`);
    console.log(`SUMMARY: ${endpoint.name}`);
    console.log(`${"-".repeat(70)}`);
    console.log(
      `Errors started appearing at: ${errorsStartedAt > 0 ? errorsStartedAt + " concurrent users" : "No errors detected"}`
    );
    console.log(
      `Max tested: ${MAX_CONCURRENCY} concurrent users`
    );
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("FULL STRESS TEST RESULTS");
  console.log(`${"=".repeat(70)}`);

  for (const [name, endpointResults] of results.entries()) {
    console.log(`\n${name}:`);
    console.log(
      "  Concurrency | Requests | Errors | Error% | p50 | p95 | p99 | RPS"
    );
    console.log("  " + "-".repeat(70));
    for (const r of endpointResults) {
      console.log(
        `  ${r.concurrency
          .toString()
          .padStart(11)} | ${r.totalRequests
          .toString()
          .padStart(8)} | ${r.errors
          .toString()
          .padStart(6)} | ${r.errorRate
          .toFixed(2)
          .padStart(6)}% | ${r.p50
          .toString()
          .padStart(3)} | ${r.p95
          .toString()
          .padStart(3)} | ${r.p99
          .toString()
          .padStart(3)} | ${r.rps.toFixed(2)}`
      );
    }
  }

  console.log(`\n✅ Stress test completed at ${new Date().toISOString()}`);
}

async function main() {
  try {
    await runStressTest();
  } catch (error) {
    console.error("❌ Stress test failed:", error);
    process.exit(1);
  }
}

main();
