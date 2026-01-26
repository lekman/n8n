import chalk from "chalk";
import { logger, printBanner } from "../utils/logger.js";
import {
  checkDocker,
  getContainerStatus,
  volumeExists,
  isImagePulled,
} from "../services/docker.js";
import {
  dockerComposeExists,
  envFileExists,
  readEnvFile,
} from "../services/config.js";

export async function status(): Promise<void> {
  printBanner();

  console.log(chalk.bold("System Status\n"));

  // Docker runtime
  const dockerInfo = await checkDocker();
  console.log(
    `Docker Runtime:     ${
      dockerInfo.available
        ? chalk.green(`✔ ${dockerInfo.runtime} (v${dockerInfo.version})`)
        : chalk.red("✖ Not available")
    }`
  );

  // Installation files
  const composeExists = dockerComposeExists();
  const envExists = envFileExists();

  console.log(
    `Docker Compose:     ${
      composeExists ? chalk.green("✔ Configured") : chalk.yellow("○ Not found")
    }`
  );

  console.log(
    `Environment File:   ${
      envExists ? chalk.green("✔ Configured") : chalk.yellow("○ Not found")
    }`
  );

  // Docker resources
  const imagePulled = await isImagePulled();
  const hasVolume = await volumeExists();

  console.log(
    `n8n Image:          ${
      imagePulled ? chalk.green("✔ Pulled") : chalk.yellow("○ Not pulled")
    }`
  );

  console.log(
    `Data Volume:        ${
      hasVolume ? chalk.green("✔ Exists") : chalk.yellow("○ Not created")
    }`
  );

  // Container status
  const containerStatus = await getContainerStatus();

  console.log();
  console.log(chalk.bold("Container Status\n"));

  if (!containerStatus) {
    console.log(chalk.yellow("○ n8n container not found"));
  } else {
    console.log(
      `Container:          ${
        containerStatus.running
          ? chalk.green("✔ Running")
          : chalk.red("✖ Stopped")
      }`
    );

    console.log(
      `Health:             ${
        containerStatus.healthy
          ? chalk.green("✔ Healthy")
          : chalk.yellow("○ " + containerStatus.status)
      }`
    );

    console.log(`Image:              ${containerStatus.image}`);
  }

  // n8n accessibility check
  console.log();
  console.log(chalk.bold("Accessibility\n"));

  try {
    // Use HTTPS with self-signed cert (skip TLS verification for health check)
    const response = await fetch("https://localhost:8443/healthz", {
      signal: AbortSignal.timeout(5000),
      tls: { rejectUnauthorized: false },
    });

    if (response.ok) {
      console.log(`Health Endpoint:    ${chalk.green("✔ Responding")}`);
      console.log(`URL:                ${chalk.cyan("https://localhost:8443")}`);
    } else {
      console.log(
        `Health Endpoint:    ${chalk.red(`✖ HTTP ${response.status}`)}`
      );
    }
  } catch {
    console.log(`Health Endpoint:    ${chalk.red("✖ Not responding")}`);
  }

  // Configuration details
  if (envExists) {
    const config = await readEnvFile();
    if (config) {
      console.log();
      console.log(chalk.bold("Configuration\n"));
      console.log(`Host:               ${config.host}`);
      console.log(`Port:               ${config.port}`);
      console.log(`Protocol:           ${config.protocol}`);
      console.log(
        `Encryption Key:     ${chalk.dim(config.encryptionKey.substring(0, 8) + "...")}`
      );
    }
  }

  // Summary
  console.log();
  const isInstalled = composeExists && envExists;
  const isRunning = containerStatus?.running && containerStatus?.healthy;

  if (isInstalled && isRunning) {
    logger.success("n8n is installed and running");
  } else if (isInstalled && !isRunning) {
    logger.warning("n8n is installed but not running");
    logger.info("Start with: bun run install:n8n");
  } else {
    logger.info("n8n is not installed");
    logger.info("Install with: bun run install:n8n");
  }
}
