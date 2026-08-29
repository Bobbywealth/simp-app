import loadtest from "loadtest";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

interface LoadTestOptions {
  endpoint: string;
  method?: string;
  concurrency: number;
  durationSec: number;
  expectedRps?: number;
  body?: object;
}

function runLoadTest(options: LoadTestOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { endpoint, method = "GET", concurrency, durationSec, body } = options;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Load Test: ${method} ${endpoint}`);
    console.log(`Concurrency: ${concurrency} users`);
    console.log(`Duration: ${durationSec}s`);
    console.log(`${"=".repeat(60)}\n`);

    const requestGenerator = body ? () => body : undefined;

    loadtest.loadTest(
      {
        url: `${API_BASE_URL}${endpoint}`,
        method,
        concurrency,
        durationSeconds: durationSec,
        maxRequests: undefined,
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
          console.error(`\n[ERROR] ${error.message}`);
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("No result returned from loadtest"));
          return;
        }

        const errors = result.errors || 0;
        const totalRequests = result.totalRequests || 0;
        const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
        const rps = result.requestsPerSecond || 0;

        console.log(`\n${"=".repeat(60)}`);
        console.log(`RESULTS: ${method} ${endpoint}`);
        console.log(`${"=".repeat(60)}`);
        console.log(`Total Requests:     ${totalRequests}`);
        console.log(`Total Errors:       ${errors}`);
        console.log(`Error Rate:          ${errorRate.toFixed(2)}%`);
        console.log(`Requests/Second:     ${rps.toFixed(2)}`);
        console.log(`Mean Latency:        ${result.meanLatencyMs}ms`);
        console.log(`Max Latency:         ${result.maxLatencyMs}ms`);
        console.log(`p50 Latency:         ${result.percentiles[50]}ms`);
        console.log(`p95 Latency:         ${result.percentiles[95]}ms`);
        console.log(`p99 Latency:         ${result.percentiles[99]}ms`);
        console.log(`${"=".repeat(60)}\n`);

        resolve();
      }
    );
  });
}

async function main() {
  console.log("\n🔬 SIMP App - Load Test Suite");
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    console.log("\n[1/2] Testing /discovery endpoint (1000 concurrent users, 60s)");
    await runLoadTest({
      endpoint: "/discovery",
      method: "GET",
      concurrency: 1000,
      durationSec: 60,
    });

    console.log("\n[2/2] Testing /live/streams endpoint (500 concurrent users, 60s)");
    await runLoadTest({
      endpoint: "/live/streams",
      method: "GET",
      concurrency: 500,
      durationSec: 60,
    });

    console.log("\n✅ Load test suite completed successfully");
  } catch (error) {
    console.error("\n❌ Load test suite failed:", error);
    process.exit(1);
  }
}

main();
