import { rm } from "node:fs/promises";
import { confirm } from "@inquirer/prompts";
import { dockerComposeExists, envFileExists, getDockerDir } from "../services/config.js";
import { composeDown, getContainerStatus, volumeExists } from "../services/docker.js";
import { createSpinner, logger, printBanner } from "../utils/logger.js";

export interface UninstallOptions {
  removeVolumes?: boolean;
  force?: boolean;
}

export async function uninstall(options: UninstallOptions = {}): Promise<void> {
  printBanner();

  // Check if n8n is installed
  if (!dockerComposeExists() && !envFileExists()) {
    logger.warning("n8n does not appear to be installed");
    process.exit(0);
  }

  // Check current status
  const status = await getContainerStatus();
  const hasVolume = await volumeExists();

  if (status?.running) {
    logger.info("n8n is currently running");
  }

  if (hasVolume) {
    logger.info("n8n data volume exists");
  }

  // Confirm uninstall unless force flag is set
  if (!options.force) {
    const shouldProceed = await confirm({
      message: "Are you sure you want to uninstall n8n?",
      default: false,
    });

    if (!shouldProceed) {
      logger.info("Uninstall cancelled");
      process.exit(0);
    }

    // Ask about volumes if they exist
    if (hasVolume && !options.removeVolumes) {
      options.removeVolumes = await confirm({
        message: "Do you want to remove n8n data (workflows, credentials)?",
        default: false,
      });
    }
  }

  // Step 1: Stop and remove containers
  const stopSpinner = createSpinner("Stopping n8n containers...");
  stopSpinner.start();

  try {
    await composeDown(options.removeVolumes);
    stopSpinner.succeed("n8n containers stopped and removed");
  } catch (_error) {
    stopSpinner.fail("Failed to stop containers");
    logger.warning("Containers may have already been removed");
  }

  // Step 2: Remove generated files
  const cleanSpinner = createSpinner("Removing generated files...");
  cleanSpinner.start();

  try {
    const dockerDir = getDockerDir();

    // Remove docker-compose.yml and .env
    await rm(`${dockerDir}/docker-compose.yml`, { force: true });
    await rm(`${dockerDir}/.env`, { force: true });

    cleanSpinner.succeed("Generated files removed");
  } catch (error) {
    cleanSpinner.fail("Failed to remove some files");
    logger.warning(String(error));
  }

  // Summary
  console.log();
  logger.success("n8n has been uninstalled");

  if (options.removeVolumes) {
    logger.info("Data volume has been removed");
  } else if (hasVolume) {
    logger.info("Data volume preserved - reinstall will restore your workflows");
    logger.info("To remove data: docker volume rm n8n_data");
  }
}
