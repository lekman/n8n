---
version: 0.1.0
status: approved
ticket: CORE-N8N-INSTALL
---

# n8n Local Installer with GAMP5 Validation

## Problem Statement

Self-hosting n8n workflow automation currently requires significant technical expertise: container runtime setup, Docker Compose configuration, environment variable management, and health check verification. This creates a barrier for users who want reliable local n8n deployments with validated installation quality. Additionally, regulated environments (pharma, medical devices) require documented Installation Qualification (IQ) and Operational Qualification (OQ) testing per GAMP5 guidelines, which currently must be performed manually.

## Vision Statement

A one-command installer that deploys n8n on macOS with OrbStack, generating GAMP5-compliant IQ/OQ test reports automatically. Users run `bun run install:n8n`, get a working n8n instance at https://localhost (TLS via Traefik reverse proxy), and can immediately validate the installation with `bun run test:iq` and `bun run test:oq`.

## User Personas

### Primary: DevOps Engineer
- Needs reliable, repeatable n8n deployments
- Wants automated validation of installation success
- Values infrastructure-as-code and scripted setup

### Secondary: Compliance Officer
- Requires documented evidence of installation qualification
- Needs JUnit reports for audit trails
- Values GAMP5-aligned testing methodology

### Tertiary: Developer
- Wants n8n running locally for workflow development
- Prefers single-command setup over manual configuration
- Values fast iteration and easy teardown

## Core Features

### Must Have

1. **CLI Installer** - TypeScript-based installer with install, uninstall, status commands
2. **Docker Compose Generation** - Generate docker-compose.yml with Traefik and n8n services
3. **TLS Termination** - Traefik reverse proxy with self-signed certificates for HTTPS
4. **Environment Configuration** - Auto-generate secure N8N_ENCRYPTION_KEY and .env file
5. **IQ Test Suite** - 8 installation qualification tests with JUnit output
6. **OQ Test Suite** - 8 operational qualification tests with JUnit output
7. **Turbo Caching** - Test result caching via Turborepo for fast re-runs

### Should Have

7. **Status Command** - Check if n8n is running and healthy
8. **Uninstall Command** - Clean removal of containers and generated files

### Out of Scope (Phase 2)

- Docker Desktop fallback (OrbStack only for now)
- Cloudflare tunnel setup
- OrbStack auto-installation
- npx compatibility
- Web-based configuration UI

## Test Strategy

### TDD Approach

All features developed following RED → GREEN → REFACTOR:

1. **RED**: Write failing test first (IQ or OQ test case)
2. **GREEN**: Implement minimal code to pass test
3. **REFACTOR**: Clean up while tests remain green

### Test Layers

| Layer | Framework | Purpose |
|-------|-----------|---------|
| IQ Tests | Bun native (`bun test`) | Verify installation correctness |
| OQ Tests | Bun native (`bun test`) | Verify operational functionality |
| JUnit Reports | Custom reporter | GAMP5 audit trail |

### IQ Test Cases

| Test ID | Test Case | Acceptance Criteria |
|---------|-----------|---------------------|
| IQ-001 | OrbStack Running | OrbStack daemon responds to docker info |
| IQ-002 | Docker Compose File Exists | docker/n8n/docker-compose.yml exists |
| IQ-003 | Environment File Exists | docker/n8n/.env exists with required vars |
| IQ-004 | n8n Container Running | Container n8n is in running state |
| IQ-005 | n8n Image Version | n8nio/n8n:latest image pulled |
| IQ-006 | Volume Created | n8n_data volume exists |
| IQ-007 | Port Binding (Traefik) | Ports 80/443 bound via Traefik |
| IQ-008 | Encryption Key Set | N8N_ENCRYPTION_KEY is 64 hex chars |

### OQ Test Cases

| Test ID | Test Case | Acceptance Criteria |
|---------|-----------|---------------------|
| OQ-001 | Health Endpoint | GET /healthz returns 200 |
| OQ-002 | Web UI Accessible | GET / returns 200 with HTML |
| OQ-003 | API Responds | GET /api/v1/workflows returns JSON |
| OQ-004 | Workflow CRUD | Can create, read, update, delete workflow |
| OQ-005 | Webhook Registration | Can register webhook trigger |
| OQ-006 | Execution Engine | Manual workflow execution completes |
| OQ-007 | Data Persistence | Data survives container restart |
| OQ-008 | Resource Limits | Memory/CPU within expected bounds |

## Acceptance Criteria

### AC-1: Installation Success
- **Given** OrbStack is running on macOS
- **When** user runs `bun run install:n8n`
- **Then** n8n container starts and responds at https://localhost within 60 seconds

### AC-2: IQ Tests Pass
- **Given** n8n has been installed successfully
- **When** user runs `bun run test:iq`
- **Then** all 8 IQ tests pass and JUnit report is generated at `.logs/test-results/junit-iq.xml`

### AC-3: OQ Tests Pass
- **Given** n8n is running and healthy
- **When** user runs `bun run test:oq`
- **Then** all 8 OQ tests pass and JUnit report is generated at `.logs/test-results/junit-oq.xml`

### AC-4: Turbo Caching Works
- **Given** tests have been run once
- **When** user runs `bun run test:validate` again without changes
- **Then** Turbo shows cached results (FULL TURBO)

### AC-5: Clean Uninstall
- **Given** n8n is installed and running
- **When** user runs `bun run uninstall:n8n`
- **Then** containers stop, generated files removed, volumes optionally preserved

## Architecture & Design

### Project Structure

```
n8n/
├── package.json                 # Bun workspace root
├── turbo.json                   # Turborepo configuration
├── packages/
│   └── installer/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts         # CLI entry point
│       │   ├── commands/
│       │   │   ├── install.ts
│       │   │   ├── uninstall.ts
│       │   │   └── status.ts
│       │   ├── services/
│       │   │   ├── docker.ts
│       │   │   └── config.ts
│       │   └── utils/
│       │       └── logger.ts
│       └── templates/
│           └── docker-compose.yml
├── docker/
│   └── n8n/                     # Generated files location
├── tests/
│   ├── shared/
│   │   └── junit-reporter.ts
│   ├── iq/
│   │   └── iq.test.ts
│   └── oq/
│       └── oq.test.ts
```

### Docker Compose Configuration

The deployment uses Traefik as a reverse proxy for TLS termination with self-signed certificates.

```yaml
services:
  traefik:
    image: traefik:v3.2
    container_name: n8n-traefik
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - WEBHOOK_URL=https://localhost/
    volumes:
      - n8n_data:/home/node/.n8n
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`localhost`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls=true"
      - "traefik.http.services.n8n.loadbalancer.server.port=5678"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - traefik

volumes:
  n8n_data:
```

## Security Considerations

- **TLS Encryption**: All traffic encrypted via Traefik with self-signed certificates
- **Secure Cookies**: n8n configured with `N8N_PROTOCOL=https` for secure session cookies
- **HTTP Redirect**: Port 80 automatically redirects to HTTPS on port 443
- **Encryption Key**: Auto-generated 64-character hex string using crypto.randomBytes
- **File Permissions**: .env file created with 600 permissions
- **No Secrets in Git**: docker/n8n/.env excluded via .gitignore
- **Local Only**: No external network exposure (localhost binding only)

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OrbStack not installed | Medium | High | Clear error message with install instructions |
| Ports 80/443 in use | Low | Medium | Check port availability before install |
| Docker pull fails | Low | Medium | Retry with exponential backoff |
| Health check timeout | Medium | Low | Configurable timeout, clear diagnostics |
| Self-signed cert warning | High | Low | Expected behavior, documented for users |

## Dependencies

### packages/installer
- commander: ^12.0.0
- @inquirer/prompts: ^7.0.0
- chalk: ^5.0.0
- ora: ^8.0.0
- yaml: ^2.0.0

### Root (monorepo)
- turbo: ^2.6.3
- typescript: ^5.0.0
- @types/bun: ^1.3.3

## Files to Create

1. `/.gitignore`
2. `/package.json`
3. `/turbo.json`
4. `/tsconfig.json`
5. `/packages/installer/package.json`
6. `/packages/installer/tsconfig.json`
7. `/packages/installer/src/index.ts`
8. `/packages/installer/src/commands/install.ts`
9. `/packages/installer/src/commands/uninstall.ts`
10. `/packages/installer/src/commands/status.ts`
11. `/packages/installer/src/services/docker.ts`
12. `/packages/installer/src/services/config.ts`
13. `/packages/installer/src/utils/logger.ts`
14. `/packages/installer/templates/docker-compose.yml`
15. `/docker/n8n/.gitkeep`
16. `/tests/shared/junit-reporter.ts`
17. `/tests/iq/package.json`
18. `/tests/iq/iq.test.ts`
19. `/tests/oq/package.json`
20. `/tests/oq/oq.test.ts`
