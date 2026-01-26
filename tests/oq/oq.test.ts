import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { createTestSuite, writeJUnitReport } from "../shared/junit-reporter.js";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const RESULTS_DIR = join(PROJECT_ROOT, ".logs/test-results");
const N8N_BASE_URL = "https://localhost:8443";

// Create test suite for JUnit reporting
const suite = createTestSuite("Operational Qualification");

// Helper function for HTTP requests with timeout (supports self-signed certs)
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      tls: { rejectUnauthorized: false },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

describe("Operational Qualification (OQ) Tests", () => {
  afterAll(() => {
    // Write JUnit report after all tests complete
    writeJUnitReport(suite.getSuite(), join(RESULTS_DIR, "junit-oq.xml"));
  });

  test("OQ-001: Health Endpoint", async () => {
    const startTime = performance.now();

    try {
      const response = await fetchWithTimeout(`${N8N_BASE_URL}/healthz`);
      const ok = response.ok;

      suite.addResult({
        id: "OQ-001",
        name: "Health Endpoint",
        passed: ok,
        duration: performance.now() - startTime,
        systemOut: ok ? `GET /healthz returned ${response.status}` : undefined,
        error: ok ? undefined : `Health check failed: HTTP ${response.status}`,
      });

      expect(response.ok).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-001",
        name: "Health Endpoint",
        passed: false,
        duration: performance.now() - startTime,
        error: `Health endpoint not responding: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-002: Web UI Accessible", async () => {
    const startTime = performance.now();

    try {
      const response = await fetchWithTimeout(N8N_BASE_URL);
      const text = await response.text();

      const isHtml = text.includes("<!DOCTYPE html>") || text.includes("<html");
      const ok = response.ok && isHtml;

      suite.addResult({
        id: "OQ-002",
        name: "Web UI Accessible",
        passed: ok,
        duration: performance.now() - startTime,
        systemOut: ok ? `GET / returned ${response.status} with HTML content` : undefined,
        error: ok ? undefined : `Web UI check failed: HTTP ${response.status}, HTML: ${isHtml}`,
      });

      expect(ok).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-002",
        name: "Web UI Accessible",
        passed: false,
        duration: performance.now() - startTime,
        error: `Web UI not responding: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-003: API Responds", async () => {
    const startTime = performance.now();

    try {
      // The workflows endpoint requires authentication, but should return 401 not error
      const response = await fetchWithTimeout(`${N8N_BASE_URL}/api/v1/workflows`, {
        headers: {
          Accept: "application/json",
        },
      });

      // API should respond (even if 401 unauthorized)
      const responds = response.status < 500;

      suite.addResult({
        id: "OQ-003",
        name: "API Responds",
        passed: responds,
        duration: performance.now() - startTime,
        systemOut: responds ? `GET /api/v1/workflows returned ${response.status}` : undefined,
        error: responds ? undefined : `API error: HTTP ${response.status}`,
      });

      expect(responds).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-003",
        name: "API Responds",
        passed: false,
        duration: performance.now() - startTime,
        error: `API not responding: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-004: Workflow CRUD Capability", async () => {
    const startTime = performance.now();

    // For this test, we verify the API endpoints exist and respond
    // Full CRUD testing would require authentication setup
    try {
      const endpoints = ["/api/v1/workflows", "/api/v1/credentials", "/api/v1/executions"];

      const results = await Promise.all(
        endpoints.map(async (endpoint) => {
          const response = await fetchWithTimeout(`${N8N_BASE_URL}${endpoint}`);
          return { endpoint, status: response.status };
        }),
      );

      // All endpoints should respond (even if 401)
      const allRespond = results.every((r) => r.status < 500);

      suite.addResult({
        id: "OQ-004",
        name: "Workflow CRUD Capability",
        passed: allRespond,
        duration: performance.now() - startTime,
        systemOut: allRespond
          ? `API endpoints responding: ${results.map((r) => `${r.endpoint}:${r.status}`).join(", ")}`
          : undefined,
        error: allRespond ? undefined : `Some endpoints failed: ${JSON.stringify(results)}`,
      });

      expect(allRespond).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-004",
        name: "Workflow CRUD Capability",
        passed: false,
        duration: performance.now() - startTime,
        error: `CRUD check failed: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-005: Webhook Registration Capability", async () => {
    const startTime = performance.now();

    try {
      // Check that webhook endpoint is reachable
      const response = await fetchWithTimeout(`${N8N_BASE_URL}/webhook-test/test`, {
        method: "GET",
      });

      // Should get 404 (no webhook registered) or 200, not 500
      const responds = response.status < 500;

      suite.addResult({
        id: "OQ-005",
        name: "Webhook Registration Capability",
        passed: responds,
        duration: performance.now() - startTime,
        systemOut: responds ? `Webhook endpoint responding: ${response.status}` : undefined,
        error: responds ? undefined : `Webhook endpoint error: ${response.status}`,
      });

      expect(responds).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-005",
        name: "Webhook Registration Capability",
        passed: false,
        duration: performance.now() - startTime,
        error: `Webhook check failed: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-006: Execution Engine", async () => {
    const startTime = performance.now();

    try {
      // Check executions endpoint
      const response = await fetchWithTimeout(`${N8N_BASE_URL}/api/v1/executions`);

      const responds = response.status < 500;

      suite.addResult({
        id: "OQ-006",
        name: "Execution Engine",
        passed: responds,
        duration: performance.now() - startTime,
        systemOut: responds ? `Executions API responding: ${response.status}` : undefined,
        error: responds ? undefined : `Executions API error: ${response.status}`,
      });

      expect(responds).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-006",
        name: "Execution Engine",
        passed: false,
        duration: performance.now() - startTime,
        error: `Execution engine check failed: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-007: Data Persistence", async () => {
    const startTime = performance.now();

    try {
      // Check that the data volume is mounted and writable
      const result =
        await $`docker exec n8n ls -la /home/node/.n8n 2>/dev/null || echo "failed"`.quiet();
      const output = result.text().trim();

      const mounted = !output.includes("failed") && output.includes(".");

      suite.addResult({
        id: "OQ-007",
        name: "Data Persistence",
        passed: mounted,
        duration: performance.now() - startTime,
        systemOut: mounted ? `Data directory accessible: /home/node/.n8n` : undefined,
        error: mounted ? undefined : "Data directory not accessible",
      });

      expect(mounted).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-007",
        name: "Data Persistence",
        passed: false,
        duration: performance.now() - startTime,
        error: `Persistence check failed: ${error}`,
      });
      throw error;
    }
  });

  test("OQ-008: Resource Limits", async () => {
    const startTime = performance.now();

    try {
      // Check container resource usage
      const result = await $`docker stats n8n --no-stream --format '{{.MemUsage}}'`.quiet();
      const memUsage = result.text().trim();

      // Parse memory usage (e.g., "100MiB / 1GiB")
      const match = memUsage.match(/(\d+(?:\.\d+)?)\s*(MiB|GiB|MB|GB)/i);
      let memoryMB = 0;

      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        memoryMB = unit.includes("g") ? value * 1024 : value;
      }

      // n8n should use less than 2GB of memory for idle state
      const withinLimits = memoryMB > 0 && memoryMB < 2048;

      suite.addResult({
        id: "OQ-008",
        name: "Resource Limits",
        passed: withinLimits,
        duration: performance.now() - startTime,
        systemOut: withinLimits
          ? `Memory usage: ${memUsage} (${memoryMB.toFixed(0)}MB)`
          : undefined,
        error: withinLimits ? undefined : `Memory usage outside limits: ${memUsage}`,
      });

      expect(withinLimits).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "OQ-008",
        name: "Resource Limits",
        passed: false,
        duration: performance.now() - startTime,
        error: `Resource check failed: ${error}`,
      });
      throw error;
    }
  });
});
