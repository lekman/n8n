import { confirm } from "@inquirer/prompts";
import {
  copyDockerCompose,
  createDefaultConfig,
  createEnvFile,
  dockerComposeExists,
  envFileExists,
} from "../services/config.js";
import { composeUp, isPortAvailable, pullImage, waitForHealthy } from "../services/docker.js";
import { ensureRuntime } from "../services/runtime.js";
import { createSpinner, logger, printBanner, printSuccess } from "../utils/logger.js";

export interface InstallOptions {
  force?: boolean;
  yes?: boolean;
  runtime?: "orbstack" | "docker";
}

export async function install(options: InstallOptions = {}): Promise<void> {
  printBanner();

  // Step 1: Ensure container runtime is available
  const runtimeSpinner = createSpinner("Checking container runtime...");
  runtimeSpinner.start();

  try {
    const runtimeStatus = await ensureRuntime({
      autoInstall: options.yes,
      preferredRuntime: options.runtime,
      onProgress: (message) => {
        runtimeSpinner.text = message;
      },
      onPrompt: async (question) => {
        runtimeSpinner.stop();
        const answer = await confirm({ message: question, default: true });
        runtimeSpinner.start();
        return answer;
      },
    });

    const runtime = runtimeStatus.activeRuntime || "unknown";
    const version = runtimeStatus.orbstack.version || runtimeStatus.docker.version || "unknown";
    runtimeSpinner.succeed(`Container runtime ready (${runtime} v${version})`);
  } catch (error) {
    runtimeSpinner.fail("Container runtime not available");
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Step 2: Check if already installed
  if (!options.force && dockerComposeExists() && envFileExists()) {
    logger.warning("n8n appears to be already installed");
    logger.info("Use --force to reinstall, or run 'bun run status' to check status");
    process.exit(0);
  }

  // Step 3: Check port availability (8443 for Traefik TLS)
  const portSpinner = createSpinner("Checking port 8443 availability...");
  portSpinner.start();

  const portAvailable = await isPortAvailable(8443);

  if (!portAvailable) {
    portSpinner.fail("Port 8443 is already in use");
    logger.error("Please stop the service using port 8443 and try again");
    process.exit(1);
  }

  portSpinner.succeed("Port 8443 is available");

  // Step 4: Pull n8n image
  const pullSpinner = createSpinner("Pulling n8n Docker image...");
  pullSpinner.start();

  try {
    await pullImage();
    pullSpinner.succeed("n8n Docker image pulled");
  } catch (_error) {
    pullSpinner.fail("Failed to pull n8n image");
    logger.error("Check your internet connection and try again");
    process.exit(1);
  }

  // Step 5: Generate configuration
  const configSpinner = createSpinner("Generating configuration...");
  configSpinner.start();

  const config = createDefaultConfig();

  try {
    await copyDockerCompose();
    await createEnvFile(config);
    configSpinner.succeed("Configuration generated");
  } catch (error) {
    configSpinner.fail("Failed to generate configuration");
    logger.error(String(error));
    process.exit(1);
  }

  // Step 6: Start containers
  const startSpinner = createSpinner("Starting n8n container...");
  startSpinner.start();

  try {
    await composeUp();
    startSpinner.succeed("n8n container started");
  } catch (error) {
    startSpinner.fail("Failed to start n8n container");
    logger.error(String(error));
    process.exit(1);
  }

  // Step 7: Wait for healthy status
  const healthSpinner = createSpinner("Waiting for n8n to be ready...");
  healthSpinner.start();

  const healthy = await waitForHealthy(120000, 2000);

  if (!healthy) {
    healthSpinner.fail("n8n did not become healthy in time");
    logger.warning("The container is running but may need more time to start");
    logger.info("Check status with: bun run status");
    process.exit(1);
  }

  healthSpinner.succeed("n8n is healthy and ready");

  // Success!
  const url = `https://${config.host}:${config.port}`;
  printSuccess(url);
}
