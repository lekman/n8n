import { $ } from "bun";
import { getDockerDir } from "./config.js";

const COMMAND_TIMEOUT_MS = 10000; // 10 seconds for quick commands
const PULL_TIMEOUT_MS = 600000; // 10 minutes for docker pull

/**
 * Run a shell command with timeout using Bun.spawn
 */
async function runWithTimeout(
  command: string,
  timeoutMs: number = COMMAND_TIMEOUT_MS,
): Promise<{ exitCode: number; stdout: string } | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(null);
    }, timeoutMs);

    const proc = Bun.spawn(["sh", "-c", command], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, DOCKER_CLI_HINTS: "false" },
    });

    proc.exited
      .then(async (exitCode) => {
        clearTimeout(timeout);
        const stdout = await new Response(proc.stdout).text();
        resolve({ exitCode, stdout });
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(null);
      });
  });
}

export interface DockerInfo {
  available: boolean;
  runtime: "orbstack" | "docker-desktop" | "unknown";
  version?: string;
}

export interface ContainerStatus {
  running: boolean;
  healthy: boolean;
  name: string;
  image: string;
  status: string;
}

/**
 * Check if Docker (via OrbStack or Docker Desktop) is available and running
 */
export async function checkDocker(): Promise<DockerInfo> {
  const result = await runWithTimeout("docker info --format '{{json .}}'");
  if (!result || result.exitCode !== 0) {
    return { available: false, runtime: "unknown" };
  }

  try {
    const info = JSON.parse(result.stdout);

    // Detect runtime
    let runtime: DockerInfo["runtime"] = "unknown";
    const serverVersion = info.ServerVersion?.toLowerCase() || "";
    const operatingSystem = info.OperatingSystem?.toLowerCase() || "";

    if (operatingSystem.includes("orbstack") || serverVersion.includes("orbstack")) {
      runtime = "orbstack";
    } else if (
      operatingSystem.includes("docker desktop") ||
      info.Name?.includes("docker-desktop")
    ) {
      runtime = "docker-desktop";
    }

    return {
      available: true,
      runtime,
      version: info.ServerVersion,
    };
  } catch {
    return { available: false, runtime: "unknown" };
  }
}

/**
 * Run docker compose up in the docker directory
 * @param extraArgs Optional extra arguments to pass to docker compose (e.g., ["--profile", "tunnel"])
 */
export async function composeUp(extraArgs?: string[]): Promise<void> {
  const dockerDir = getDockerDir();
  const composeFile = `${dockerDir}/docker-compose.yml`;

  if (extraArgs && extraArgs.length > 0) {
    await $`docker compose -f ${composeFile} ${extraArgs} up -d`.quiet();
  } else {
    await $`docker compose -f ${composeFile} up -d`.quiet();
  }
}

/**
 * Run docker compose down in the docker directory
 */
export async function composeDown(removeVolumes = false): Promise<void> {
  const dockerDir = getDockerDir();
  if (removeVolumes) {
    await $`docker compose -f ${dockerDir}/docker-compose.yml down -v`.quiet();
  } else {
    await $`docker compose -f ${dockerDir}/docker-compose.yml down`.quiet();
  }
}

/**
 * Get the status of the n8n container
 */
export async function getContainerStatus(): Promise<ContainerStatus | null> {
  // Filter for exact container name "n8n" (not n8n-traefik)
  const result = await runWithTimeout("docker ps -a --filter \"name=^n8n$\" --format '{{json .}}'");
  if (!result || result.exitCode !== 0) {
    return null;
  }

  try {
    const output = result.stdout.trim();
    if (!output) {
      return null;
    }

    // Handle potential multiple lines (take first match)
    const firstLine = output.split("\n")[0];
    const container = JSON.parse(firstLine);

    return {
      running: container.State === "running",
      healthy: container.Status?.includes("healthy") || false,
      name: container.Names,
      image: container.Image,
      status: container.Status,
    };
  } catch {
    return null;
  }
}

/**
 * Wait for the n8n container to be healthy
 */
export async function waitForHealthy(timeoutMs = 120000, intervalMs = 2000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await getContainerStatus();

    if (status?.healthy) {
      return true;
    }

    // Also check if we can reach the health endpoint via HTTPS (self-signed cert)
    try {
      const response = await fetch("https://localhost:8443/healthz", {
        tls: { rejectUnauthorized: false },
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Container not ready yet
    }

    await Bun.sleep(intervalMs);
  }

  return false;
}

/**
 * Check if the n8n image is pulled
 */
export async function isImagePulled(): Promise<boolean> {
  const result = await runWithTimeout("docker images n8nio/n8n --format '{{.Repository}}'");
  return result?.stdout.trim().includes("n8nio/n8n") ?? false;
}

/**
 * Check if the n8n_data volume exists
 */
export async function volumeExists(): Promise<boolean> {
  const result = await runWithTimeout(
    "docker volume ls --filter \"name=n8n_data\" --format '{{.Name}}'",
  );
  return result?.stdout.trim().includes("n8n_data") ?? false;
}

/**
 * Check if port 5678 is in use
 */
export async function isPortAvailable(port = 5678): Promise<boolean> {
  const result = await runWithTimeout(`lsof -i :${port}`);
  // lsof returns non-zero (or null on timeout) if port is free
  if (!result) return true;
  return result.stdout.trim() === "";
}

/**
 * Pull the required Docker images (n8n and Traefik)
 */
export async function pullImage(): Promise<void> {
  // Use longer timeout for pulls (10 minutes each)
  const traefikResult = await runWithTimeout("docker pull traefik:v3.2", PULL_TIMEOUT_MS);
  if (!traefikResult || traefikResult.exitCode !== 0) {
    throw new Error("Failed to pull traefik image (timeout or error)");
  }

  const n8nResult = await runWithTimeout("docker pull n8nio/n8n:latest", PULL_TIMEOUT_MS);
  if (!n8nResult || n8nResult.exitCode !== 0) {
    throw new Error("Failed to pull n8n image (timeout or error)");
  }
}

/**
 * Restart the n8n container
 */
export async function restartContainer(): Promise<void> {
  const dockerDir = getDockerDir();
  await $`docker compose -f ${dockerDir}/docker-compose.yml restart`.quiet();
}
