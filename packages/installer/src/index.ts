#!/usr/bin/env bun

import { program } from "commander";
import { install } from "./commands/install.js";
import { status } from "./commands/status.js";
import { uninstall } from "./commands/uninstall.js";

program
  .name("n8n-installer")
  .description("One-command installer for n8n with GAMP5 IQ/OQ validation")
  .version("0.1.0");

program
  .command("install")
  .description("Install and start n8n")
  .option("-f, --force", "Force reinstall even if already installed")
  .option("-y, --yes", "Auto-accept prompts (install OrbStack if needed)")
  .option("--runtime <type>", "Preferred runtime: orbstack or docker", "orbstack")
  .action(async (options) => {
    await install({
      force: options.force,
      yes: options.yes,
      runtime: options.runtime,
    });
  });

program
  .command("uninstall")
  .description("Stop and remove n8n")
  .option("-v, --remove-volumes", "Also remove n8n data volume")
  .option("-f, --force", "Skip confirmation prompts")
  .action(async (options) => {
    await uninstall({
      removeVolumes: options.removeVolumes,
      force: options.force,
    });
  });

program
  .command("status")
  .description("Show n8n installation status")
  .action(async () => {
    await status();
  });

program.parse();
