import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora, { type Ora } from "ora";

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
export const VERSION = packageJson.version;

export const logger = {
  info: (message: string) => console.log(chalk.blue("ℹ"), message),
  success: (message: string) => console.log(chalk.green("✔"), message),
  warning: (message: string) => console.log(chalk.yellow("⚠"), message),
  error: (message: string) => console.log(chalk.red("✖"), message),
  step: (message: string) => console.log(chalk.cyan("→"), message),
};

export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: "cyan",
  });
}

export function printBanner() {
  console.log();
  console.log(chalk.cyan.bold(`n8n Local Installer v${VERSION}`));
  console.log(chalk.dim("GAMP5 IQ/OQ Validated Deployment"));
  console.log();
}

export function printSuccess(localUrl: string, externalUrl?: string | null) {
  console.log();
  console.log(chalk.green.bold("Installation Complete!"));
  console.log();

  if (externalUrl) {
    console.log(`  Local URL:     ${chalk.cyan(localUrl)}`);
    console.log(`  External URL:  ${chalk.cyan(externalUrl)}`);
    console.log(`  Webhooks:      ${chalk.cyan(`${externalUrl}/webhook/...`)}`);
  } else {
    console.log(`  n8n is running at: ${chalk.cyan(localUrl)}`);
  }

  console.log();
  console.log(chalk.dim("  Next steps:"));
  console.log(chalk.dim("  1. Open the URL in your browser"));
  console.log(chalk.dim("  2. Create your n8n account"));
  console.log(chalk.dim("  3. Start building workflows!"));
  console.log();
  console.log(chalk.dim("  Run validation tests:"));
  console.log(chalk.dim("  bun run test:iq    (Installation)"));
  console.log(chalk.dim("  bun run test:oq    (Operational)"));
  console.log();
}
