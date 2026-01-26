import chalk from "chalk";
import ora, { type Ora } from "ora";

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
  console.log(
    chalk.cyan(`
╔═══════════════════════════════════════════╗
║       n8n Local Installer v0.1.0          ║
║   GAMP5 IQ/OQ Validated Deployment        ║
╚═══════════════════════════════════════════╝
`),
  );
}

export function printSuccess(url: string) {
  const paddedUrl = url.padEnd(39);
  console.log(
    chalk.green(`
╔═══════════════════════════════════════════╗
║           Installation Complete!          ║
╠═══════════════════════════════════════════╣
║  n8n is running at:                       ║
║  `) +
      chalk.cyan(paddedUrl) +
      chalk.green(` ║
║                                           ║
║  Next steps:                              ║
║  1. Open the URL in your browser          ║
║  2. Create your n8n account               ║
║  3. Start building workflows!             ║
║                                           ║
║  Run validation tests:                    ║
║  bun run test:iq    (Installation)        ║
║  bun run test:oq    (Operational)         ║
╚═══════════════════════════════════════════╝
`),
  );
}
