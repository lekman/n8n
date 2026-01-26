import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { readTunnelConfig } from "../../packages/installer/src/services/config.js";
import { detectRuntime } from "../../packages/installer/src/services/runtime.js";
import { createTestSuite, writeJUnitReport } from "../shared/junit-reporter.js";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const DOCKER_DIR = join(PROJECT_ROOT, "docker/n8n");
const RESULTS_DIR = join(PROJECT_ROOT, ".logs/test-results");

// Create test suite for JUnit reporting
const suite = createTestSuite("Installation Qualification");

describe("Installation Qualification (IQ) Tests", () => {
  afterAll(() => {
    // Write JUnit report after all tests complete
    writeJUnitReport(suite.getSuite(), join(RESULTS_DIR, "junit-iq.xml"));
  });

  test("IQ-001: OrbStack/Docker Running", async () => {
    const startTime = performance.now();
    let systemOut = "";

    try {
      const result = await $`docker info --format '{{.ServerVersion}}'`.quiet();
      const version = result.text().trim();

      expect(version).toBeTruthy();
      systemOut = `Docker daemon responding. Version: ${version}`;

      suite.addResult({
        id: "IQ-001",
        name: "OrbStack/Docker Running",
        passed: true,
        duration: performance.now() - startTime,
        systemOut,
      });
    } catch (error) {
      suite.addResult({
        id: "IQ-001",
        name: "OrbStack/Docker Running",
        passed: false,
        duration: performance.now() - startTime,
        error: "Docker daemon not responding",
      });
      throw error;
    }
  });

  test("IQ-002: Docker Compose File Exists", async () => {
    const startTime = performance.now();
    const composePath = join(DOCKER_DIR, "docker-compose.yml");

    const exists = existsSync(composePath);

    suite.addResult({
      id: "IQ-002",
      name: "Docker Compose File Exists",
      passed: exists,
      duration: performance.now() - startTime,
      systemOut: exists ? `Found: ${composePath}` : undefined,
      error: exists ? undefined : `File not found: ${composePath}`,
    });

    expect(exists).toBe(true);
  });

  test("IQ-003: Environment File Exists", async () => {
    const startTime = performance.now();
    const envPath = join(DOCKER_DIR, ".env");

    const exists = existsSync(envPath);

    if (exists) {
      const content = readFileSync(envPath, "utf-8");
      const hasEncryptionKey = content.includes("N8N_ENCRYPTION_KEY=");
      const hasHost = content.includes("N8N_HOST=");

      const valid = hasEncryptionKey && hasHost;

      suite.addResult({
        id: "IQ-003",
        name: "Environment File Exists",
        passed: valid,
        duration: performance.now() - startTime,
        systemOut: valid ? `Found: ${envPath} with required variables` : undefined,
        error: valid ? undefined : "Missing required environment variables",
      });

      expect(valid).toBe(true);
    } else {
      suite.addResult({
        id: "IQ-003",
        name: "Environment File Exists",
        passed: false,
        duration: performance.now() - startTime,
        error: `File not found: ${envPath}`,
      });

      throw new Error(`Environment file not found: ${envPath}`);
    }
  });

  test("IQ-004: n8n Container Running", async () => {
    const startTime = performance.now();

    try {
      // Use docker inspect for exact container name match
      const result =
        await $`docker inspect --format '{{.State.Status}}' n8n 2>/dev/null || echo "not found"`.quiet();
      const state = result.text().trim();

      const running = state === "running";

      suite.addResult({
        id: "IQ-004",
        name: "n8n Container Running",
        passed: running,
        duration: performance.now() - startTime,
        systemOut: running ? `Container state: ${state}` : undefined,
        error: running ? undefined : `Container state: ${state || "not found"}`,
      });

      expect(running).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "IQ-004",
        name: "n8n Container Running",
        passed: false,
        duration: performance.now() - startTime,
        error: "Failed to check container status",
      });
      throw error;
    }
  });

  test("IQ-005: n8n Image Pulled", async () => {
    const startTime = performance.now();

    try {
      const result = await $`docker images n8nio/n8n --format '{{.Repository}}:{{.Tag}}'`.quiet();
      const images = result.text().trim();

      const pulled = images.includes("n8nio/n8n");

      suite.addResult({
        id: "IQ-005",
        name: "n8n Image Pulled",
        passed: pulled,
        duration: performance.now() - startTime,
        systemOut: pulled ? `Images: ${images}` : undefined,
        error: pulled ? undefined : "n8n image not found",
      });

      expect(pulled).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "IQ-005",
        name: "n8n Image Pulled",
        passed: false,
        duration: performance.now() - startTime,
        error: "Failed to check Docker images",
      });
      throw error;
    }
  });

  test("IQ-006: Volume Created", async () => {
    const startTime = performance.now();

    try {
      const result =
        await $`docker volume ls --filter "name=n8n_data" --format '{{.Name}}'`.quiet();
      const volumes = result.text().trim();

      const exists = volumes.includes("n8n_data");

      suite.addResult({
        id: "IQ-006",
        name: "Volume Created",
        passed: exists,
        duration: performance.now() - startTime,
        systemOut: exists ? `Volume: ${volumes}` : undefined,
        error: exists ? undefined : "n8n_data volume not found",
      });

      expect(exists).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "IQ-006",
        name: "Volume Created",
        passed: false,
        duration: performance.now() - startTime,
        error: "Failed to check Docker volumes",
      });
      throw error;
    }
  });

  test("IQ-007: Port Binding (Traefik)", async () => {
    const startTime = performance.now();

    try {
      // Check Traefik port 8443
      const result = await $`docker port n8n-traefik 8443 2>/dev/null || echo "not bound"`.quiet();
      const binding = result.text().trim();

      // Check if port is bound
      const bound = binding.includes(":8443") && !binding.includes("not bound");

      suite.addResult({
        id: "IQ-007",
        name: "Port Binding (Traefik)",
        passed: bound,
        duration: performance.now() - startTime,
        systemOut: bound ? `Port binding: 8443=${binding}` : undefined,
        error: bound ? undefined : `Port 8443 not bound: ${binding}`,
      });

      expect(bound).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "IQ-007",
        name: "Port Binding (Traefik)",
        passed: false,
        duration: performance.now() - startTime,
        error: "Failed to check port binding",
      });
      throw error;
    }
  });

  test("IQ-008: Runtime Detection", async () => {
    const startTime = performance.now();

    try {
      const runtimeStatus = await detectRuntime();

      // At least one runtime should be ready since Docker is working
      const hasRuntime = runtimeStatus.ready;
      const activeRuntime = runtimeStatus.activeRuntime || "none";

      suite.addResult({
        id: "IQ-008",
        name: "Runtime Detection",
        passed: hasRuntime,
        duration: performance.now() - startTime,
        systemOut: hasRuntime
          ? `Active runtime: ${activeRuntime}, OrbStack: ${runtimeStatus.orbstack.installed ? "installed" : "not installed"}, Docker: ${runtimeStatus.docker.installed ? "installed" : "not installed"}`
          : undefined,
        error: hasRuntime ? undefined : "No container runtime detected",
      });

      expect(hasRuntime).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "IQ-008",
        name: "Runtime Detection",
        passed: false,
        duration: performance.now() - startTime,
        error: `Runtime detection failed: ${error}`,
      });
      throw error;
    }
  });

  test("IQ-009: Encryption Key Set", async () => {
    const startTime = performance.now();
    const envPath = join(DOCKER_DIR, ".env");

    if (!existsSync(envPath)) {
      suite.addResult({
        id: "IQ-009",
        name: "Encryption Key Set",
        passed: false,
        duration: performance.now() - startTime,
        error: "Environment file not found",
      });
      throw new Error("Environment file not found");
    }

    const content = readFileSync(envPath, "utf-8");
    const match = content.match(/N8N_ENCRYPTION_KEY=([^\n]+)/);

    if (match) {
      const key = match[1];
      // Key should be 64 hex characters
      const valid = /^[a-f0-9]{64}$/i.test(key);

      suite.addResult({
        id: "IQ-009",
        name: "Encryption Key Set",
        passed: valid,
        duration: performance.now() - startTime,
        systemOut: valid ? `Key length: ${key.length} chars, valid hex format` : undefined,
        error: valid ? undefined : `Invalid key format: length=${key.length}`,
      });

      expect(valid).toBe(true);
    } else {
      suite.addResult({
        id: "IQ-009",
        name: "Encryption Key Set",
        passed: false,
        duration: performance.now() - startTime,
        error: "N8N_ENCRYPTION_KEY not found in .env",
      });
      throw new Error("N8N_ENCRYPTION_KEY not found in .env");
    }
  });

  // Cloudflare Tunnel IQ Tests (conditional - only run if tunnel is configured)
  test("IQ-CF-001: Cloudflared Service in Template", async () => {
    const startTime = performance.now();
    const composePath = join(DOCKER_DIR, "docker-compose.yml");

    if (!existsSync(composePath)) {
      suite.addResult({
        id: "IQ-CF-001",
        name: "Cloudflared Service in Template",
        passed: true, // Skip if no compose file (tunnel not configured)
        duration: performance.now() - startTime,
        systemOut: "Skipped: docker-compose.yml not found (tunnel not configured)",
      });
      return;
    }

    const content = readFileSync(composePath, "utf-8");
    const hasCloudflared = content.includes("cloudflare/cloudflared");

    suite.addResult({
      id: "IQ-CF-001",
      name: "Cloudflared Service in Template",
      passed: true, // Always pass - just checking if template is ready
      duration: performance.now() - startTime,
      systemOut: hasCloudflared
        ? "Cloudflared service definition found in docker-compose.yml"
        : "Cloudflared service not in docker-compose.yml (local-only mode)",
    });

    // This test always passes - it's informational
    expect(true).toBe(true);
  });

  test("IQ-CF-002: Tunnel Configuration Variables", async () => {
    const startTime = performance.now();

    const tunnelConfig = await readTunnelConfig();

    if (!tunnelConfig) {
      suite.addResult({
        id: "IQ-CF-002",
        name: "Tunnel Configuration Variables",
        passed: true, // Skip if no tunnel configured
        duration: performance.now() - startTime,
        systemOut: "Skipped: No tunnel configuration found (local-only mode)",
      });
      return;
    }

    // Verify all required tunnel variables are present
    const requiredVars = [
      "apiToken",
      "accountId",
      "zoneId",
      "zoneName",
      "tunnelId",
      "tunnelName",
      "tunnelToken",
      "hostname",
      "dnsRecordId",
    ];

    const missingVars = requiredVars.filter((v) => !tunnelConfig[v as keyof typeof tunnelConfig]);
    const valid = missingVars.length === 0;

    suite.addResult({
      id: "IQ-CF-002",
      name: "Tunnel Configuration Variables",
      passed: valid,
      duration: performance.now() - startTime,
      systemOut: valid ? `Tunnel configured for: ${tunnelConfig.hostname}` : undefined,
      error: valid ? undefined : `Missing variables: ${missingVars.join(", ")}`,
    });

    expect(valid).toBe(true);
  });

  test("IQ-CF-003: Cloudflared Container Running", async () => {
    const startTime = performance.now();

    const tunnelConfig = await readTunnelConfig();

    if (!tunnelConfig) {
      suite.addResult({
        id: "IQ-CF-003",
        name: "Cloudflared Container Running",
        passed: true, // Skip if no tunnel configured
        duration: performance.now() - startTime,
        systemOut: "Skipped: No tunnel configuration found (local-only mode)",
      });
      return;
    }

    try {
      const result =
        await $`docker inspect --format '{{.State.Status}}' n8n-cloudflared 2>/dev/null || echo "not found"`.quiet();
      const state = result.text().trim();

      const running = state === "running";

      suite.addResult({
        id: "IQ-CF-003",
        name: "Cloudflared Container Running",
        passed: running,
        duration: performance.now() - startTime,
        systemOut: running ? `Cloudflared container state: ${state}` : undefined,
        error: running ? undefined : `Cloudflared container state: ${state || "not found"}`,
      });

      expect(running).toBe(true);
    } catch (error) {
      suite.addResult({
        id: "IQ-CF-003",
        name: "Cloudflared Container Running",
        passed: false,
        duration: performance.now() - startTime,
        error: "Failed to check cloudflared container status",
      });
      throw error;
    }
  });
});
