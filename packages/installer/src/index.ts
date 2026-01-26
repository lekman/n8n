#!/usr/bin/env bun

import { program } from "commander";
import { install } from "./commands/install.js";
import { status } from "./commands/status.js";
import { uninstall } from "./commands/uninstall.js";
import { VERSION } from "./utils/logger.js";

program
  .name("n8n-installer")
  .description("One-command installer for n8n with GAMP5 IQ/OQ validation")
  .version(VERSION);

program
  .command("install")
  .description("Install and start n8n with Cloudflare Tunnel")
  .option("-f, --force", "Force reinstall even if already installed")
  .option("-y, --yes", "Auto-accept prompts (install OrbStack if needed)")
  .option("--runtime <type>", "Preferred runtime: orbstack or docker", "orbstack")
  .option("--local", "Local-only install (no Cloudflare Tunnel)")
  .option("--cloudflare-token <token>", "Cloudflare API token (for non-interactive use)")
  .option("--domain <domain>", "Domain for tunnel (e.g., example.com)")
  .option("--subdomain <subdomain>", "Subdomain for n8n (default: n8n)")
  .action(async (options) => {
    await install({
      force: options.force,
      yes: options.yes,
      runtime: options.runtime,
      local: options.local,
      cloudflareToken: options.cloudflareToken,
      domain: options.domain,
      subdomain: options.subdomain,
    });
  });

program
  .command("uninstall")
  .description("Stop and remove n8n")
  .option("-v, --remove-volumes", "Also remove n8n data volume")
  .option("-f, --force", "Skip confirmation prompts")
  .option("-y, --yes", "Auto-confirm cloud resource deletion")
  .action(async (options) => {
    await uninstall({
      removeVolumes: options.removeVolumes,
      force: options.force,
      yes: options.yes,
    });
  });

program
  .command("status")
  .description("Show n8n installation status")
  .action(async () => {
    await status();
  });

program.parse();
