import { existsSync } from "node:fs";
import { $ } from "bun";

export interface RuntimeStatus {
  orbstack: {
    installed: boolean;
    running: boolean;
    version?: string;
  };
  docker: {
    installed: boolean;
    running: boolean;
    version?: string;
  };
  homebrew: {
    installed: boolean;
  };
  ready: boolean;
  activeRuntime?: "orbstack" | "docker-desktop";
}

const STARTUP_TIMEOUT_MS = 60000; // 1 minute per PRD decision
const POLL_INTERVAL_MS = 2000;
const COMMAND_TIMEOUT_MS = 5000; // 5 seconds for detection commands

/**
 * Run a shell command with timeout using Bun.spawn
 * Prevents hanging when Docker/OrbStack daemon isn't responding (common over SSH)
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

/**
 * Detect installed container runtimes and their status
 */
export async function detectRuntime(): Promise<RuntimeStatus> {
  const [orbstack, docker, homebrew] = await Promise.all([
    detectOrbStack(),
    detectDockerDesktop(),
    detectHomebrew(),
  ]);

  // Determine if any runtime is ready
  const ready = orbstack.running || docker.running;
  let activeRuntime: RuntimeStatus["activeRuntime"];

  if (orbstack.running) {
    activeRuntime = "orbstack";
  } else if (docker.running) {
    activeRuntime = "docker-desktop";
  }

  return {
    orbstack,
    docker,
    homebrew,
    ready,
    activeRuntime,
  };
}

/**
 * Detect OrbStack installation and running status
 */
async function detectOrbStack(): Promise<RuntimeStatus["orbstack"]> {
  // Check if installed via command or app bundle
  const appExists = existsSync("/Applications/OrbStack.app");
  let commandExists = false;
  let running = false;
  let version: string | undefined;

  const whichResult = await runWithTimeout("which orb");
  commandExists = whichResult?.exitCode === 0;

  const installed = appExists || commandExists;

  if (installed) {
    // Check if running via orb status
    const statusResult = await runWithTimeout("orb status");
    if (statusResult?.exitCode === 0) {
      running = statusResult.stdout.toLowerCase().includes("running");
    }

    // Fallback: check via docker info
    if (!running) {
      const dockerResult = await runWithTimeout("docker info --format '{{.OperatingSystem}}'");
      if (dockerResult?.exitCode === 0) {
        running = dockerResult.stdout.toLowerCase().includes("orbstack");
      }
    }

    // Get version if running
    if (running) {
      const versionResult = await runWithTimeout("orb version");
      if (versionResult?.exitCode === 0) {
        // Output is "Version: 2.0.5 (2000500)" - extract just the version number
        const match = versionResult.stdout.match(/(\d+\.\d+\.\d+)/);
        version = match ? match[1] : versionResult.stdout.trim().split("\n")[0];
      }
    }
  }

  return { installed, running, version };
}

/**
 * Detect Docker Desktop installation and running status
 */
async function detectDockerDesktop(): Promise<RuntimeStatus["docker"]> {
  // Check if installed via app bundle or command
  const appExists = existsSync("/Applications/Docker.app");
  let commandExists = false;
  let running = false;
  let version: string | undefined;

  const whichResult = await runWithTimeout("which docker");
  commandExists = whichResult?.exitCode === 0;

  const installed = appExists || commandExists;

  if (installed) {
    // Check if running via docker info
    const dockerResult = await runWithTimeout("docker info --format '{{.OperatingSystem}}'");
    if (dockerResult?.exitCode === 0) {
      const os = dockerResult.stdout.toLowerCase();
      // Docker Desktop but not OrbStack
      running =
        (os.includes("docker desktop") || os.includes("docker engine")) && !os.includes("orbstack");

      // Get version if running
      if (running) {
        const versionResult = await runWithTimeout("docker version --format '{{.Server.Version}}'");
        if (versionResult?.exitCode === 0) {
          version = versionResult.stdout.trim();
        }
      }
    }
  }

  return { installed, running, version };
}

/**
 * Detect if Homebrew is available
 */
async function detectHomebrew(): Promise<RuntimeStatus["homebrew"]> {
  const result = await runWithTimeout("which brew");
  return { installed: result?.exitCode === 0 };
}

/**
 * Install OrbStack via Homebrew
 */
export async function installOrbStack(onProgress?: (message: string) => void): Promise<void> {
  const status = await detectRuntime();

  if (!status.homebrew.installed) {
    throw new Error(
      "Homebrew is not installed. Please install OrbStack manually:\n" +
        "  1. Download from https://orbstack.dev/download\n" +
        "  2. Open the downloaded .dmg and drag to Applications\n" +
        "  3. Launch OrbStack from Applications",
    );
  }

  onProgress?.("Installing OrbStack via Homebrew...");

  try {
    await $`brew install orbstack`.quiet();
  } catch (error) {
    throw new Error(
      `Failed to install OrbStack via Homebrew: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Start OrbStack daemon
 */
export async function startOrbStack(onProgress?: (message: string) => void): Promise<void> {
  onProgress?.("Starting OrbStack...");

  try {
    // Try CLI start first
    const result = await $`orb start`.quiet().nothrow();

    if (result.exitCode !== 0) {
      // Fallback to opening the app
      await $`open -a OrbStack`.quiet();
    }
  } catch {
    // If orb command fails, try opening the app
    try {
      await $`open -a OrbStack`.quiet();
    } catch {
      throw new Error("Failed to start OrbStack. Please start it manually.");
    }
  }
}

/**
 * Start Docker Desktop
 */
export async function startDockerDesktop(onProgress?: (message: string) => void): Promise<void> {
  onProgress?.("Starting Docker Desktop...");

  try {
    await $`open -a Docker`.quiet();
  } catch {
    throw new Error("Failed to start Docker Desktop. Please start it manually.");
  }
}

/**
 * Wait for container runtime to be ready
 */
export async function waitForReady(
  onProgress?: (message: string, elapsed: number) => void,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    onProgress?.(`Waiting for container runtime... (${elapsed}s)`, elapsed);

    try {
      const result = await $`docker info`.quiet().nothrow();
      if (result.exitCode === 0) {
        return true;
      }
    } catch {
      // Not ready yet
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }

  return false;
}

/**
 * Ensure a container runtime is available
 * This is the main entry point for runtime setup
 */
export async function ensureRuntime(options: {
  autoInstall?: boolean;
  preferredRuntime?: "orbstack" | "docker";
  onProgress?: (message: string) => void;
  onPrompt?: (question: string) => Promise<boolean>;
}): Promise<RuntimeStatus> {
  const { autoInstall = false, preferredRuntime = "orbstack", onProgress, onPrompt } = options;

  // Skip in CI environments
  if (process.env.CI) {
    onProgress?.("CI environment detected, skipping runtime check");
    const status = await detectRuntime();
    if (!status.ready) {
      throw new Error("No container runtime available in CI environment");
    }
    return status;
  }

  onProgress?.("Checking container runtime...");

  const status = await detectRuntime();

  // Already ready
  if (status.ready) {
    onProgress?.(`Container runtime ready (${status.activeRuntime})`);
    return status;
  }

  // OrbStack installed but not running
  if (status.orbstack.installed && !status.orbstack.running) {
    onProgress?.("OrbStack installed but not running");
    await startOrbStack(onProgress);

    if (await waitForReady(onProgress)) {
      return detectRuntime();
    }
    throw new Error("OrbStack failed to start within timeout");
  }

  // Docker Desktop installed but not running
  if (status.docker.installed && !status.docker.running) {
    onProgress?.("Docker Desktop installed but not running");
    await startDockerDesktop(onProgress);

    if (await waitForReady(onProgress)) {
      return detectRuntime();
    }
    throw new Error("Docker Desktop failed to start within timeout");
  }

  // Nothing installed - offer to install OrbStack
  onProgress?.("No container runtime found");

  if (preferredRuntime === "orbstack") {
    const shouldInstall =
      autoInstall || (onPrompt && (await onPrompt("Install OrbStack via Homebrew?")));

    if (shouldInstall) {
      await installOrbStack(onProgress);
      await startOrbStack(onProgress);

      if (await waitForReady(onProgress)) {
        return detectRuntime();
      }
      throw new Error("OrbStack failed to start after installation");
    }
  }

  // Provide manual instructions
  throw new Error(
    "No container runtime available.\n\n" +
      "To install OrbStack (recommended):\n" +
      "  brew install orbstack\n\n" +
      "Or download Docker Desktop:\n" +
      "  https://www.docker.com/products/docker-desktop/",
  );
}
