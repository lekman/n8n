import { $ } from "bun";
import { getDockerDir } from "./config.js";

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
  try {
    const result = await $`docker info --format '{{json .}}'`.quiet();
    const info = JSON.parse(result.text());

    // Detect runtime
    let runtime: DockerInfo["runtime"] = "unknown";
    const serverVersion = info.ServerVersion?.toLowerCase() || "";
    const operatingSystem = info.OperatingSystem?.toLowerCase() || "";

    if (operatingSystem.includes("orbstack") || serverVersion.includes("orbstack")) {
      runtime = "orbstack";
    } else if (operatingSystem.includes("docker desktop") || info.Name?.includes("docker-desktop")) {
      runtime = "docker-desktop";
    }

    return {
      available: true,
      runtime,
      version: info.ServerVersion,
    };
  } catch {
    return {
      available: false,
      runtime: "unknown",
    };
  }
}

/**
 * Run docker compose up in the docker directory
 */
export async function composeUp(): Promise<void> {
  const dockerDir = getDockerDir();
  await $`docker compose -f ${dockerDir}/docker-compose.yml up -d`.quiet();
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
  try {
    const result = await $`docker ps -a --filter "name=n8n" --format '{{json .}}'`.quiet();
    const output = result.text().trim();

    if (!output) {
      return null;
    }

    const container = JSON.parse(output);

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
export async function waitForHealthy(
  timeoutMs = 120000,
  intervalMs = 2000
): Promise<boolean> {
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
  try {
    const result = await $`docker images n8nio/n8n --format '{{.Repository}}'`.quiet();
    return result.text().trim().includes("n8nio/n8n");
  } catch {
    return false;
  }
}

/**
 * Check if the n8n_data volume exists
 */
export async function volumeExists(): Promise<boolean> {
  try {
    const result = await $`docker volume ls --filter "name=n8n_data" --format '{{.Name}}'`.quiet();
    return result.text().trim().includes("n8n_data");
  } catch {
    return false;
  }
}

/**
 * Check if port 5678 is in use
 */
export async function isPortAvailable(port = 5678): Promise<boolean> {
  try {
    const result = await $`lsof -i :${port}`.quiet();
    return result.text().trim() === "";
  } catch {
    // lsof returns non-zero if port is free
    return true;
  }
}

/**
 * Pull the required Docker images (n8n and Traefik)
 */
export async function pullImage(): Promise<void> {
  await $`docker pull traefik:v3.2`.quiet();
  await $`docker pull n8nio/n8n:latest`.quiet();
}

/**
 * Restart the n8n container
 */
export async function restartContainer(): Promise<void> {
  const dockerDir = getDockerDir();
  await $`docker compose -f ${dockerDir}/docker-compose.yml restart`.quiet();
}
