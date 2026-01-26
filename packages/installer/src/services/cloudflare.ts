/**
 * Cloudflare API service for tunnel management
 * Handles tunnel creation, DNS configuration, and cleanup
 */

import { randomBytes } from "node:crypto";
import { hostname } from "node:os";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CloudflareConfig {
  apiToken: string;
  accountId?: string;
  zoneId?: string;
  tunnelId?: string;
  tunnelName?: string;
  tunnelToken?: string;
  hostname?: string;
  dnsRecordId?: string;
}

export interface Zone {
  id: string;
  name: string;
  status: string;
  account: {
    id: string;
    name: string;
  };
}

export interface Tunnel {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

interface TokenVerifyResult {
  id: string;
  status: string;
}

interface Account {
  id: string;
  name: string;
}

interface TunnelCreateResult {
  id: string;
  name: string;
  credentials_file: {
    AccountTag: string;
    TunnelID: string;
    TunnelName: string;
    TunnelSecret: string;
  };
}

// Tunnel token is returned as a raw string, not wrapped in an object

interface DnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
}

export class CloudflareService {
  private apiToken: string;
  private accountId?: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Make an authenticated request to the Cloudflare API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<CloudflareResponse<T>> {
    const url = `${CLOUDFLARE_API_BASE}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as CloudflareResponse<T>;

    if (!data.success) {
      const errorMessage = data.errors.map((e) => e.message).join(", ");
      throw new Error(`Cloudflare API error: ${errorMessage}`);
    }

    return data;
  }

  /**
   * Validate the API token
   * FR-1.2: Validate token with GET /user/tokens/verify
   */
  async validateToken(): Promise<boolean> {
    try {
      const response = await this.request<TokenVerifyResult>("GET", "/user/tokens/verify");
      return response.result.status === "active";
    } catch {
      return false;
    }
  }

  /**
   * Get the account ID for the authenticated user
   * FR-2.1: Retrieve account ID via GET /accounts or from zones
   */
  async getAccountId(): Promise<string> {
    if (this.accountId) {
      return this.accountId;
    }

    // Try /accounts endpoint first (requires Account:Read permission)
    try {
      const response = await this.request<Account[]>("GET", "/accounts");
      if (response.result.length > 0) {
        this.accountId = response.result[0].id;
        return this.accountId;
      }
    } catch {
      // Token may not have account-level permissions, fall back to zones
    }

    // Fall back to getting account from zones (zone-scoped tokens include this)
    const zones = await this.listZones();
    if (zones.length > 0 && zones[0].account?.id) {
      this.accountId = zones[0].account.id;
      return this.accountId;
    }

    throw new Error(
      "Could not determine Cloudflare account ID. Ensure your token has Account:Read or Zone:Read permissions.",
    );
  }

  /**
   * List available zones (domains)
   * FR-2.2: List available zones via GET /zones
   */
  async listZones(): Promise<Zone[]> {
    const response = await this.request<Zone[]>("GET", "/zones?status=active");
    return response.result;
  }

  /**
   * Generate a unique tunnel name
   * FR-3.2: Generate tunnel name: n8n-{hostname}-{random-4}
   */
  generateTunnelName(): string {
    const host = hostname()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const suffix = randomBytes(2).toString("hex");
    return `n8n-${host}-${suffix}`;
  }

  /**
   * Create a new Cloudflare Tunnel
   * FR-3.1: Create tunnel via POST /accounts/{account_id}/cfd_tunnel
   * FR-3.3: Generate cryptographically secure tunnel secret
   */
  async createTunnel(name: string): Promise<{ id: string; name: string }> {
    const accountId = await this.getAccountId();

    // Generate a cryptographically secure tunnel secret (32 bytes, base64 encoded)
    const tunnelSecret = randomBytes(32).toString("base64");

    const response = await this.request<TunnelCreateResult>(
      "POST",
      `/accounts/${accountId}/cfd_tunnel`,
      {
        name,
        tunnel_secret: tunnelSecret,
        config_src: "cloudflare", // Use remotely-managed configuration
      },
    );

    return {
      id: response.result.id,
      name: response.result.name,
    };
  }

  /**
   * Configure tunnel ingress rules
   * FR-4.1: Configure ingress via PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations
   * FR-4.2: Route subdomain.domain to http://localhost:5678
   * FR-4.3: Add catch-all rule returning 404 for unmatched hosts
   */
  async configureTunnelIngress(
    tunnelId: string,
    publicHostname: string,
    serviceUrl = "http://n8n:5678",
  ): Promise<void> {
    const accountId = await this.getAccountId();

    await this.request("PUT", `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      config: {
        ingress: [
          {
            hostname: publicHostname,
            service: serviceUrl,
            originRequest: {
              noTLSVerify: true,
            },
          },
          {
            // Catch-all rule (required by Cloudflare)
            service: "http_status:404",
          },
        ],
      },
    });
  }

  /**
   * Get the tunnel token for cloudflared
   * FR-3.4: Retrieve tunnel token via API for cloudflared
   */
  async getTunnelToken(tunnelId: string): Promise<string> {
    const accountId = await this.getAccountId();

    const response = await this.request<string>(
      "GET",
      `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`,
    );

    // API returns token directly as a string in result
    return response.result;
  }

  /**
   * Create a DNS CNAME record pointing to the tunnel
   * FR-5.1: Create proxied CNAME record via POST /zones/{zone_id}/dns_records
   * FR-5.2: CNAME target: {tunnel_id}.cfargotunnel.com
   */
  async createDnsRecord(
    zoneId: string,
    subdomain: string,
    tunnelId: string,
  ): Promise<{ id: string; name: string }> {
    const cnameTarget = `${tunnelId}.cfargotunnel.com`;

    const response = await this.request<DnsRecord>("POST", `/zones/${zoneId}/dns_records`, {
      type: "CNAME",
      name: subdomain,
      content: cnameTarget,
      proxied: true,
      comment: "Created by n8n-local-deploy",
    });

    return {
      id: response.result.id,
      name: response.result.name,
    };
  }

  /**
   * Check if a DNS record already exists
   * FR-5.3: Handle existing DNS record
   */
  async findDnsRecord(zoneId: string, name: string): Promise<DnsRecord | null> {
    const response = await this.request<DnsRecord[]>(
      "GET",
      `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
    );

    return response.result.length > 0 ? response.result[0] : null;
  }

  /**
   * Update an existing DNS record
   */
  async updateDnsRecord(
    zoneId: string,
    recordId: string,
    subdomain: string,
    tunnelId: string,
  ): Promise<void> {
    const cnameTarget = `${tunnelId}.cfargotunnel.com`;

    await this.request("PUT", `/zones/${zoneId}/dns_records/${recordId}`, {
      type: "CNAME",
      name: subdomain,
      content: cnameTarget,
      proxied: true,
      comment: "Updated by n8n-local-deploy",
    });
  }

  /**
   * Delete a DNS record
   * FR-7.2: --uninstall must delete DNS CNAME record via API
   */
  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request("DELETE", `/zones/${zoneId}/dns_records/${recordId}`);
  }

  /**
   * Delete a tunnel
   * FR-7.1: --uninstall must delete tunnel via API
   */
  async deleteTunnel(tunnelId: string): Promise<void> {
    const accountId = await this.getAccountId();
    await this.request("DELETE", `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
  }

  /**
   * List existing tunnels to find duplicates
   * FR-3.5: Handle existing tunnel with same name gracefully
   */
  async listTunnels(): Promise<Tunnel[]> {
    const accountId = await this.getAccountId();
    const response = await this.request<Tunnel[]>(
      "GET",
      `/accounts/${accountId}/cfd_tunnel?is_deleted=false`,
    );
    return response.result;
  }

  /**
   * Find an existing tunnel by name prefix
   */
  async findTunnelByPrefix(prefix: string): Promise<Tunnel | null> {
    const tunnels = await this.listTunnels();
    return tunnels.find((t) => t.name.startsWith(prefix)) || null;
  }
}

/**
 * Validate subdomain format
 * FR-5.5: Validate subdomain format (alphanumeric, hyphens, no leading/trailing hyphen)
 */
export function isValidSubdomain(subdomain: string): boolean {
  // Must be 1-63 characters, alphanumeric or hyphens, no leading/trailing hyphen
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  return subdomainRegex.test(subdomain);
}
