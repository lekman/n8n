import { confirm, input, password, select } from "@inquirer/prompts";
import { CloudflareService, isValidSubdomain, type Zone } from "../services/cloudflare.js";
import {
  copyDockerCompose,
  copyDockerComposeWithTunnel,
  createDefaultConfig,
  createEnvFile,
  createTunnelConfig,
  createTunnelConfigFromExisting,
  createTunnelEnvFile,
  dockerComposeExists,
  envFileExists,
  getExistingEncryptionKey,
  readEnvFile,
  type TunnelConfig,
} from "../services/config.js";
import { composeUp, isPortAvailable, pullImage, waitForHealthy } from "../services/docker.js";
import { ensureRuntime } from "../services/runtime.js";
import { createSpinner, logger, printBanner, printSuccess } from "../utils/logger.js";

export interface InstallOptions {
  force?: boolean;
  yes?: boolean;
  runtime?: "orbstack" | "docker";
  local?: boolean;
  cloudflareToken?: string;
  domain?: string;
  subdomain?: string;
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
  const alreadyInstalled = dockerComposeExists() && envFileExists();
  const useTunnel = !options.local;
  const addingTunnelToExisting = alreadyInstalled && useTunnel && !options.force;

  if (alreadyInstalled && options.local && !options.force) {
    logger.warning("n8n appears to be already installed");
    logger.info("Use --force to reinstall, or run 'bun run status' to check status");
    process.exit(0);
  }

  if (addingTunnelToExisting) {
    logger.info("Adding Cloudflare Tunnel to existing n8n installation...");
  }

  // Step 3: Check port availability (8443 for Traefik TLS)
  // Skip port check if adding tunnel to existing installation (n8n already uses the port)
  if (!addingTunnelToExisting) {
    const portSpinner = createSpinner("Checking port 8443 availability...");
    portSpinner.start();

    const portAvailable = await isPortAvailable(8443);

    if (!portAvailable) {
      portSpinner.fail("Port 8443 is already in use");
      logger.error("Please stop the service using port 8443 and try again");
      process.exit(1);
    }

    portSpinner.succeed("Port 8443 is available");
  }

  // Step 4: Pull n8n image (skip if adding tunnel to existing)
  if (!addingTunnelToExisting) {
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
  }

  // Step 5: Configure Cloudflare Tunnel (default, unless --local)
  let tunnelConfig: TunnelConfig | null = null;
  let externalUrl: string | null = null;

  if (useTunnel) {
    tunnelConfig = await setupCloudflareTunnel(options);
    if (tunnelConfig) {
      externalUrl = `https://${tunnelConfig.hostname}`;
    }
  }

  // Step 6: Generate configuration
  const configSpinner = createSpinner(
    addingTunnelToExisting ? "Updating configuration for tunnel..." : "Generating configuration...",
  );
  configSpinner.start();

  let config: Awaited<ReturnType<typeof createDefaultConfig>>;

  // Check for existing encryption key in volume (prevents key mismatch on reinstall)
  const existingVolumeKey = await getExistingEncryptionKey();

  if (addingTunnelToExisting && tunnelConfig) {
    // Preserve existing encryption key when adding tunnel
    const existingConfig = await readEnvFile();
    if (existingConfig) {
      config = createTunnelConfigFromExisting(existingConfig, tunnelConfig.hostname);
    } else {
      config = createTunnelConfig(tunnelConfig.hostname);
    }
  } else if (tunnelConfig) {
    config = createTunnelConfig(tunnelConfig.hostname);
  } else {
    config = createDefaultConfig();
  }

  // Override with existing volume key if found (preserves data compatibility)
  if (existingVolumeKey && config.encryptionKey !== existingVolumeKey) {
    config.encryptionKey = existingVolumeKey;
    logger.info("Using existing encryption key from n8n data volume");
  }

  try {
    if (tunnelConfig) {
      await copyDockerComposeWithTunnel();
      await createTunnelEnvFile(config, tunnelConfig);
    } else {
      await copyDockerCompose();
      await createEnvFile(config);
    }
    configSpinner.succeed(
      addingTunnelToExisting ? "Configuration updated" : "Configuration generated",
    );
  } catch (error) {
    configSpinner.fail("Failed to generate configuration");
    logger.error(String(error));
    process.exit(1);
  }

  // Step 7: Start containers (or restart if adding tunnel)
  const startSpinner = createSpinner(
    addingTunnelToExisting ? "Restarting containers with tunnel..." : "Starting n8n container...",
  );
  startSpinner.start();

  try {
    // Use tunnel profile if tunnel is configured
    await composeUp(tunnelConfig ? ["--profile", "tunnel"] : undefined);
    startSpinner.succeed(
      tunnelConfig ? "n8n and cloudflared containers started" : "n8n container started",
    );
  } catch (error) {
    startSpinner.fail("Failed to start containers");
    logger.error(String(error));
    process.exit(1);
  }

  // Step 8: Wait for healthy status
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
  const localUrl = `https://${config.host}:${config.port}`;
  printSuccess(localUrl, externalUrl);
}

/**
 * Set up Cloudflare Tunnel for external access
 * FR-1 through FR-5: Token management, zone selection, tunnel creation, ingress config, DNS
 */
async function setupCloudflareTunnel(options: InstallOptions): Promise<TunnelConfig | null> {
  console.log();
  logger.info("Configuring Cloudflare Tunnel for external access...");
  console.log();

  // FR-1.1, FR-1.5, FR-1.6: Get API token from flag, env var, or prompt
  let apiToken = options.cloudflareToken || process.env.CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    apiToken = await password({
      message: "Enter your Cloudflare API token:",
      mask: "*",
    });
  }

  // FR-1.2: Validate token
  const tokenSpinner = createSpinner("Validating Cloudflare API token...");
  tokenSpinner.start();

  const cloudflare = new CloudflareService(apiToken);
  const tokenValid = await cloudflare.validateToken();

  if (!tokenValid) {
    tokenSpinner.fail("Invalid Cloudflare API token");
    logger.error("Please check your token and ensure it has the required permissions:");
    logger.info("  - Zone: Read");
    logger.info("  - DNS: Edit");
    logger.info("  - Cloudflare Tunnel: Edit");
    process.exit(1);
  }

  tokenSpinner.succeed("Cloudflare API token validated");

  // FR-2.1: Get account ID
  const accountId = await cloudflare.getAccountId();

  // FR-2.2, FR-2.3, FR-2.4: List zones and select
  let zones: Zone[];
  let selectedZone: Zone;

  const zoneSpinner = createSpinner("Fetching available domains...");
  zoneSpinner.start();

  try {
    zones = await cloudflare.listZones();
  } catch (error) {
    zoneSpinner.fail("Failed to fetch domains");
    logger.error(String(error));
    process.exit(1);
  }

  if (zones.length === 0) {
    zoneSpinner.fail("No active domains found in your Cloudflare account");
    process.exit(1);
  }

  zoneSpinner.succeed(`Found ${zones.length} domain(s)`);

  if (options.domain) {
    // FR-2.4: Use --domain flag
    const zone = zones.find((z) => z.name === options.domain);
    if (!zone) {
      logger.error(`Domain '${options.domain}' not found in your Cloudflare account`);
      logger.info(`Available domains: ${zones.map((z) => z.name).join(", ")}`);
      process.exit(1);
    }
    selectedZone = zone;
  } else {
    // FR-2.3: Interactive selection
    selectedZone = await select({
      message: "Select your domain:",
      choices: zones.map((zone) => ({
        name: zone.name,
        value: zone,
      })),
    });
  }

  // FR-5.4, FR-5.5: Get and validate subdomain
  let subdomain: string;

  if (options.subdomain) {
    subdomain = options.subdomain;
  } else {
    subdomain = await input({
      message: "Enter subdomain for n8n:",
      default: "n8n",
      validate: (value) => {
        if (!isValidSubdomain(value)) {
          return "Invalid subdomain format. Use alphanumeric characters and hyphens only.";
        }
        return true;
      },
    });
  }

  const fullHostname = `${subdomain}.${selectedZone.name}`;
  logger.info(`n8n will be accessible at https://${fullHostname}`);
  console.log();

  // FR-5.3: Check for existing DNS record
  const existingRecord = await cloudflare.findDnsRecord(selectedZone.id, fullHostname);

  if (existingRecord) {
    const shouldUpdate = await confirm({
      message: `DNS record for ${fullHostname} already exists. Update it?`,
      default: true,
    });

    if (!shouldUpdate) {
      logger.info("Tunnel setup cancelled");
      process.exit(0);
    }
  }

  // FR-3.1, FR-3.2, FR-3.3: Create tunnel
  const tunnelSpinner = createSpinner("Creating Cloudflare Tunnel...");
  tunnelSpinner.start();

  let tunnel: { id: string; name: string };

  try {
    const tunnelName = cloudflare.generateTunnelName();
    tunnel = await cloudflare.createTunnel(tunnelName);
    tunnelSpinner.succeed(`Tunnel created: ${tunnel.name}`);
  } catch (error) {
    tunnelSpinner.fail("Failed to create tunnel");
    logger.error(String(error));
    process.exit(1);
  }

  // FR-4.1, FR-4.2, FR-4.3: Configure ingress
  const ingressSpinner = createSpinner("Configuring tunnel ingress...");
  ingressSpinner.start();

  try {
    await cloudflare.configureTunnelIngress(tunnel.id, fullHostname);
    ingressSpinner.succeed("Tunnel ingress configured");
  } catch (error) {
    ingressSpinner.fail("Failed to configure ingress");
    logger.error(String(error));
    // Clean up the tunnel we just created
    await cloudflare.deleteTunnel(tunnel.id).catch(() => {});
    process.exit(1);
  }

  // FR-3.4: Get tunnel token
  const tokenFetchSpinner = createSpinner("Fetching tunnel token...");
  tokenFetchSpinner.start();

  let tunnelToken: string;

  try {
    tunnelToken = await cloudflare.getTunnelToken(tunnel.id);
    tokenFetchSpinner.succeed("Tunnel token retrieved");
  } catch (error) {
    tokenFetchSpinner.fail("Failed to get tunnel token");
    logger.error(String(error));
    await cloudflare.deleteTunnel(tunnel.id).catch(() => {});
    process.exit(1);
  }

  // FR-5.1, FR-5.2: Create or update DNS record
  const dnsSpinner = createSpinner("Configuring DNS...");
  dnsSpinner.start();

  let dnsRecordId: string;

  try {
    if (existingRecord) {
      await cloudflare.updateDnsRecord(selectedZone.id, existingRecord.id, subdomain, tunnel.id);
      dnsRecordId = existingRecord.id;
      dnsSpinner.succeed(`DNS record updated: ${fullHostname}`);
    } else {
      const dnsRecord = await cloudflare.createDnsRecord(selectedZone.id, subdomain, tunnel.id);
      dnsRecordId = dnsRecord.id;
      dnsSpinner.succeed(`DNS record created: ${fullHostname}`);
    }
  } catch (error) {
    dnsSpinner.fail("Failed to configure DNS");
    logger.error(String(error));
    await cloudflare.deleteTunnel(tunnel.id).catch(() => {});
    process.exit(1);
  }

  console.log();

  return {
    apiToken,
    accountId,
    zoneId: selectedZone.id,
    zoneName: selectedZone.name,
    tunnelId: tunnel.id,
    tunnelName: tunnel.name,
    tunnelToken,
    hostname: fullHostname,
    dnsRecordId,
  };
}
