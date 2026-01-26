# PRD-003: Cloudflare Tunnel Integration

| Field | Value |
|-------|-------|
| **Document Owner** | Tobias Lekman |
| **Status** | Draft |
| **Created** | 2026-01-26 |
| **Target Release** | v0.4.0 |

## Problem Statement

The current n8n deployment is only accessible on localhost. Users who want to use webhooks, external integrations, or access n8n from outside their local network must manually configure port forwarding, dynamic DNS, or tunnel solutions. This requires significant DevOps knowledge and creates security risks.

### Current Behavior

```
$ bunx @lekman/n8n-local-deploy install
✓ n8n installed successfully
  URL: https://localhost:8443

# Webhooks don't work - n8n is not accessible externally
# No secure way to access from phone or other devices
```

### Target Behavior

```
$ bunx @lekman/n8n-local-deploy install --tunnel

Checking container runtime...
  ✓ OrbStack is ready

? Configure Cloudflare Tunnel for external access? (Y/n) Y

? Enter your Cloudflare API token: ********
  ✓ Token validated

? Select your domain:
  ❯ lekman.com
    example.org

? Enter subdomain for n8n: n8n
  → n8n will be accessible at https://n8n.lekman.com

Creating Cloudflare Tunnel...
  ✓ Tunnel created: n8n-local-abc123

Configuring DNS...
  ✓ CNAME record created: n8n.lekman.com → tunnel

Starting services...
  ✓ n8n container started
  ✓ cloudflared container started

✓ n8n is ready!
  Local URL: https://localhost:8443
  External URL: https://n8n.lekman.com

  Webhooks will work at: https://n8n.lekman.com/webhook/...
```

## Goals

1. **One-command external access** - Tunnel setup fully automated via Cloudflare API
2. **Secure by default** - All traffic encrypted through Cloudflare's edge
3. **Zero port forwarding** - No router configuration needed
4. **Webhook-ready** - External services can reach n8n webhooks immediately
5. **Graceful degradation** - Local-only mode remains default if tunnel not configured

## Non-Goals

- Cloudflare Access policies (authentication beyond n8n's built-in auth)
- Multiple tunnel endpoints
- Custom SSL certificates (Cloudflare handles TLS)
- Cloudflare Workers integration
- Zero Trust dashboard configuration

## Functional Requirements

### FR-1: API Token Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Accept Cloudflare API token via interactive prompt (masked input) | Must Have |
| FR-1.2 | Validate token with `GET /user/tokens/verify` before proceeding | Must Have |
| FR-1.3 | Validate token has required permissions (Tunnel Edit, DNS Edit, Zone Read) | Must Have |
| FR-1.4 | Store token securely in `.env` file with 600 permissions | Must Have |
| FR-1.5 | Support `--cloudflare-token` CLI flag for non-interactive use | Should Have |
| FR-1.6 | Support `CLOUDFLARE_API_TOKEN` environment variable | Should Have |

### FR-2: Zone Selection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Retrieve account ID via `GET /accounts` | Must Have |
| FR-2.2 | List available zones via `GET /zones` | Must Have |
| FR-2.3 | Display zones in interactive selection menu | Must Have |
| FR-2.4 | Support `--domain` CLI flag to skip zone selection | Should Have |
| FR-2.5 | Cache zone list to avoid repeated API calls | Could Have |

### FR-3: Tunnel Creation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Create tunnel via `POST /accounts/{account_id}/cfd_tunnel` | Must Have |
| FR-3.2 | Generate tunnel name: `n8n-{hostname}-{random-4}` (e.g., `n8n-macmini-a3b2`) | Must Have |
| FR-3.3 | Generate cryptographically secure tunnel secret | Must Have |
| FR-3.4 | Retrieve tunnel token via API for cloudflared | Must Have |
| FR-3.5 | Handle existing tunnel with same name gracefully | Should Have |
| FR-3.6 | Store tunnel ID in config for future management | Must Have |

### FR-4: Ingress Configuration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Configure ingress via `PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations` | Must Have |
| FR-4.2 | Route subdomain.domain to `http://localhost:5678` | Must Have |
| FR-4.3 | Add catch-all rule returning 404 for unmatched hosts | Must Have |
| FR-4.4 | Support custom port via `--port` flag | Should Have |

### FR-5: DNS Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Create proxied CNAME record via `POST /zones/{zone_id}/dns_records` | Must Have |
| FR-5.2 | CNAME target: `{tunnel_id}.cfargotunnel.com` | Must Have |
| FR-5.3 | Handle existing DNS record (update or error with clear message) | Must Have |
| FR-5.4 | Support `--subdomain` CLI flag | Should Have |
| FR-5.5 | Validate subdomain format (alphanumeric, hyphens, no leading/trailing hyphen) | Must Have |

### FR-6: Container Deployment

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Add cloudflared service to docker-compose.yml | Must Have |
| FR-6.2 | Use official `cloudflare/cloudflared:latest` image | Must Have |
| FR-6.3 | Pass tunnel token via `TUNNEL_TOKEN` environment variable | Must Have |
| FR-6.4 | Configure cloudflared to depend on n8n service | Must Have |
| FR-6.5 | Configure n8n `WEBHOOK_URL` to use external hostname | Must Have |
| FR-6.6 | Restart policy: `unless-stopped` | Must Have |

### FR-7: Uninstallation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | `--uninstall` must delete tunnel via API | Must Have |
| FR-7.2 | `--uninstall` must delete DNS CNAME record via API | Must Have |
| FR-7.3 | `--uninstall` must stop and remove cloudflared container | Must Have |
| FR-7.4 | Prompt for confirmation before deleting cloud resources | Must Have |
| FR-7.5 | Support `--yes` flag to skip confirmation | Should Have |

## Technical Design

### Cloudflare API Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Start Tunnel Setup                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ GET /user/      │
                    │ tokens/verify   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ Valid                       │ Invalid
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ GET /accounts   │          │ Error: Invalid  │
    │ Get account ID  │          │ token           │
    └────────┬────────┘          └─────────────────┘
             │
             ▼
    ┌─────────────────┐
    │ GET /zones      │
    │ List domains    │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ User selects    │
    │ domain          │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ POST /accounts/ │
    │ {id}/cfd_tunnel │
    │ Create tunnel   │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ PUT /accounts/  │
    │ {id}/cfd_tunnel/│
    │ {tid}/config    │
    │ Set ingress     │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ GET /accounts/  │
    │ {id}/cfd_tunnel/│
    │ {tid}/token     │
    │ Get run token   │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ POST /zones/    │
    │ {zid}/dns_records│
    │ Create CNAME    │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Generate config │
    │ Start containers│
    └─────────────────┘
```

### New Service: CloudflareService

```typescript
// packages/installer/src/services/cloudflare.ts

interface CloudflareConfig {
  apiToken: string;
  accountId?: string;
  zoneId?: string;
  tunnelId?: string;
  tunnelName?: string;
  hostname?: string;
}

interface Zone {
  id: string;
  name: string;
  status: string;
}

interface Tunnel {
  id: string;
  name: string;
  token: string;
}

interface CloudflareService {
  validateToken(token: string): Promise<boolean>;
  getAccountId(): Promise<string>;
  listZones(): Promise<Zone[]>;
  createTunnel(name: string): Promise<Tunnel>;
  configureTunnelIngress(tunnelId: string, hostname: string, service: string): Promise<void>;
  getTunnelToken(tunnelId: string): Promise<string>;
  createDnsRecord(zoneId: string, name: string, tunnelId: string): Promise<void>;
  deleteTunnel(tunnelId: string): Promise<void>;
  deleteDnsRecord(zoneId: string, recordId: string): Promise<void>;
}
```

### Updated docker-compose.yml Template

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    # ... existing traefik config ...

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - '5678:5678'
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=${WEBHOOK_URL}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
    labels:
      - "traefik.enable=true"
      # ... existing labels ...

  # New service for Cloudflare Tunnel
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - n8n
    profiles:
      - tunnel  # Only started when tunnel is configured

volumes:
  n8n_data:
```

### Environment Variables

| Variable | Source | Example |
|----------|--------|---------|
| `N8N_HOST` | Prompt or localhost | `n8n.lekman.com` |
| `WEBHOOK_URL` | Derived from N8N_HOST | `https://n8n.lekman.com/` |
| `N8N_ENCRYPTION_KEY` | Auto-generated | `a1b2c3d4...` |
| `CLOUDFLARE_API_TOKEN` | User prompt | `CF_xxxx...` |
| `CLOUDFLARE_TUNNEL_TOKEN` | API response | `eyJhIjoiYWNj...` |
| `CLOUDFLARE_TUNNEL_ID` | API response | `abc123-def456...` |
| `CLOUDFLARE_ZONE_ID` | API response | `xyz789...` |

### File Changes

| File | Change |
|------|--------|
| `packages/installer/src/services/cloudflare.ts` | New - Cloudflare API client |
| `packages/installer/src/commands/install.ts` | Modify - Add tunnel setup flow |
| `packages/installer/src/commands/uninstall.ts` | Modify - Add tunnel cleanup |
| `packages/installer/templates/docker-compose.yml` | Modify - Add cloudflared service |
| `packages/installer/src/services/config.ts` | Modify - Add tunnel config variables |

## Test Cases

### IQ Tests (Installation Qualification)

| ID | Test Case | Acceptance Criteria |
|----|-----------|---------------------|
| IQ-CF-001 | Token validation | Valid token passes, invalid token fails with clear error |
| IQ-CF-002 | Zone listing | Zones retrieved and displayed correctly |
| IQ-CF-003 | Tunnel creation | Tunnel created with unique name |
| IQ-CF-004 | DNS record creation | CNAME record created with correct target |
| IQ-CF-005 | Config generation | docker-compose.yml includes cloudflared service |

### OQ Tests (Operational Qualification)

| ID | Test Case | Acceptance Criteria |
|----|-----------|---------------------|
| OQ-CF-001 | End-to-end tunnel | External URL resolves to local n8n |
| OQ-CF-002 | Webhook delivery | External webhook reaches n8n |
| OQ-CF-003 | Container restart | cloudflared reconnects after restart |
| OQ-CF-004 | Uninstall cleanup | Tunnel and DNS deleted from Cloudflare |

## Acceptance Criteria

1. User can run `bunx @lekman/n8n-local-deploy install --tunnel` and access n8n externally
2. Cloudflare API token is validated before any modifications
3. Tunnel appears in Cloudflare Zero Trust dashboard
4. DNS record resolves to tunnel endpoint
5. Webhooks work from external services (tested with webhook.site)
6. `--uninstall` removes all cloud resources
7. Local-only mode continues to work without `--tunnel` flag
8. All existing IQ/OQ tests continue to pass

## Security Considerations

| Risk | Mitigation |
|------|------------|
| API token exposure | Never log token; mask in prompts; store in .env with 600 perms |
| Tunnel token exposure | Store only in .env; never commit to git |
| Unauthorized access | Rely on n8n's built-in authentication |
| DNS hijacking | Cloudflare's proxied CNAME prevents direct IP exposure |
| Token scope creep | Document minimum required permissions |

## Rollout Plan

1. Implement CloudflareService with API client
2. Add unit tests with mocked API responses
3. Integrate tunnel flow into install command
4. Add tunnel cleanup to uninstall command
5. Update docker-compose template
6. Add IQ tests for tunnel configuration
7. Manual testing with real Cloudflare account
8. Update INSTALL.md with Cloudflare setup instructions
9. Release as v0.4.0

## Decisions

| Question | Decision |
|----------|----------|
| Tunnel naming | `n8n-{hostname}-{random-4}` (e.g., `n8n-macmini-a3b2`) - identifiable and unique |
| Existing tunnel handling | Delete existing tunnel with same name prefix, or update ingress if tunnel ID stored |
| API token storage | `.env` file with 600 permissions - simple and portable |
| Tunnel-only mode | No - local access always available (future RAG needs direct access) |

## Dependencies

- PRD-002: Container Runtime Detection (completed)
- Cloudflare account with at least one domain
- Cloudflare API token with required permissions

## References

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare API v4 Documentation](https://developers.cloudflare.com/api/)
- [cloudflared Docker Image](https://hub.docker.com/r/cloudflare/cloudflared)
