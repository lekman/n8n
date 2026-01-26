# Quality Assurance

[n8n Local Installer](README.md)

Quality assurance strategy for validating n8n installation and operation following GAMP5 principles.

## Test Pyramid

```plaintext
                        ┌─────────────┐
                        │  E2E / UAT  │  Full workflow execution
                        │   (Manual)  │  User acceptance testing
                        └──────┬──────┘
                               │
                   ┌───────────┴───────────┐
                   │    OQ (Operational)   │  Verify n8n functions correctly
                   │       (Automated)     │  API, webhooks, persistence
                   └───────────┬───────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │           IQ (Installation)           │  Verify installation correct
           │              (Automated)              │  Docker, files, containers
           └───────────────────────────────────────┘
```

## Quick Start

Tests run via go-task. Install with `brew install go-task/tap/go-task`.

```bash
task iq      # Installation Qualification tests
task oq      # Operational Qualification tests
task t       # Run all validation tests
```

JUnit XML reports are generated in `.logs/test-results/`.

## Test Layers

### Layer 1: IQ (Installation Qualification)

**What:** Validate the system is installed correctly with all required components.

**Why:**

- Ensure Docker/OrbStack is configured correctly
- Verify all configuration files exist
- Confirm containers and volumes are created
- Validate security settings (encryption key)

**Scope:**

| Test ID | Test Case | Acceptance Criteria |
|---------|-----------|---------------------|
| IQ-001 | OrbStack/Docker Running | Docker daemon responds to `docker info` |
| IQ-002 | Docker Compose File Exists | `docker/n8n/docker-compose.yml` exists |
| IQ-003 | Environment File Exists | `docker/n8n/.env` with required variables |
| IQ-004 | n8n Container Running | Container `n8n` in running state |
| IQ-005 | n8n Image Pulled | `n8nio/n8n:latest` image available |
| IQ-006 | Volume Created | `n8n_data` volume exists |
| IQ-007 | Port Binding (Traefik) | Port 8443 bound to localhost |
| IQ-008 | Encryption Key Set | 64-character hex key in `.env` |

**Cloudflare Tunnel Tests (conditional):**

| Test ID | Test Case | Acceptance Criteria |
|---------|-----------|---------------------|
| IQ-CF-001 | Cloudflared Service in Template | `cloudflare/cloudflared` image in compose |
| IQ-CF-002 | Tunnel Configuration Variables | All CLOUDFLARE_* env vars present |
| IQ-CF-003 | Cloudflared Container Running | Container `n8n-cloudflared` running |

These tests only run when tunnel is configured (local-only mode skips them).

**Where:** After installation, before OQ tests

**Run:**

```bash
task iq                  # Run IQ tests
bun test tests/iq/       # Alternative: direct bun test
```

### Layer 2: OQ (Operational Qualification)

**What:** Verify the deployed system functions correctly.

**Why:**

- Confirm n8n is accessible via HTTPS
- Validate API endpoints respond
- Test core functionality (webhooks, execution)
- Verify data persistence

**Scope:**

| Test ID | Test Case | Acceptance Criteria |
|---------|-----------|---------------------|
| OQ-001 | Health Endpoint | `GET /healthz` returns 200 |
| OQ-002 | Web UI Accessible | `GET /` returns HTML content |
| OQ-003 | API Responds | `GET /api/v1/workflows` returns < 500 |
| OQ-004 | Workflow CRUD Capability | API endpoints respond |
| OQ-005 | Webhook Registration | Webhook endpoint reachable |
| OQ-006 | Execution Engine | Executions API responds |
| OQ-007 | Data Persistence | Data directory accessible |
| OQ-008 | Resource Limits | Memory usage < 2GB |

**Where:** After IQ tests pass, with n8n running

**Run:**

```bash
task oq                  # Run OQ tests
bun test tests/oq/       # Alternative: direct bun test
```

### Layer 3: E2E / UAT (Manual)

**What:** Full workflow validation by end users.

**Why:**

- Validate complete user workflows
- Test actual business scenarios
- Verify integration with external services

**Scope:**

- Create and execute workflows
- Configure credentials
- Test webhook triggers
- Validate scheduling

**Where:** After OQ tests pass, manual execution

## Test Strategy Matrix

| Layer | Local Dev | CI (PR) | CD (Deploy) | Required For |
|-------|-----------|---------|-------------|--------------|
| IQ | After install | Yes | After deploy | Every installation |
| OQ | After IQ | Yes | After deploy | Every deployment |
| E2E/UAT | Manual | - | Manual | Release validation |

## Tool Reference

| Category | Command | Purpose |
|----------|---------|---------|
| **Install** | `task i` | Install n8n with Cloudflare Tunnel |
| **Install** | `task i FORCE=1` | Force reinstall |
| **Install** | `task i DOMAIN=x SUBDOMAIN=y` | Tunnel with options |
| **Install** | `task il` | Install for local access only |
| **Uninstall** | `task u` | Remove n8n installation |
| **Status** | `task s` | Check installation status |
| **Testing** | `task t` | Run all validation tests |
| **Testing** | `task iq` | Run IQ tests only |
| **Testing** | `task oq` | Run OQ tests only |
| **QA** | `task qa` | Run all QA checks |
| **QA** | `task lint` | Run Biome linter |
| **QA** | `task security` | Run Semgrep scan |
| **Logs** | `task n8n:logs` | View n8n container logs |
| **Restart** | `task n8n:restart` | Restart n8n container |
| **Shell** | `task n8n:shell` | Open shell in container |
| **Open** | `task n8n:open` | Open n8n in browser |

## Prerequisites

**Required:**

- macOS with [OrbStack](https://orbstack.dev) or Docker Desktop
- [Bun](https://bun.sh) runtime (v1.3+)
- [go-task](https://taskfile.dev) (`brew install go-task/tap/go-task`)

**Setup:**

```bash
bun install              # Install dependencies
task i                   # Install n8n
```

## Evidence Collection

Test results are written as JUnit XML for audit trails:

| File | Description |
|------|-------------|
| `.logs/test-results/junit-iq.xml` | IQ test results |
| `.logs/test-results/junit-oq.xml` | OQ test results |

**Generate evidence:**

```bash
task t                   # Run all tests, generates XML reports
```

**CI/CD evidence:**

JUnit XML reports can be consumed by CI systems for test reporting and artifact retention.

## Success Criteria

**Production readiness requires:**

- All IQ tests pass (installation correct)
- All OQ tests pass (operation verified)
- E2E/UAT validated (workflows functional)

**Test execution summary:**

| Test Suite | Tests | Auto-generated Report |
|------------|-------|----------------------|
| IQ (Core) | 8 | `junit-iq.xml` |
| IQ (Tunnel) | 3 | `junit-iq.xml` |
| OQ | 8 | `junit-oq.xml` |
| **Total** | **19** | |

Tunnel tests are conditional and skip gracefully in local-only mode.

## Architecture

**Local Mode:**
```
┌───────────────────────────────────────────────────────┐
│              OrbStack / Docker                        │
│   ┌─────────────────┐    ┌─────────────────────┐      │
│   │    Traefik      │───▶│        n8n          │      │
│   │   Port 8443     │    │     Port 5678       │      │
│   └─────────────────┘    └──────────┬──────────┘      │
│                                     │                 │
│                               ┌─────┴─────┐           │
│                               │ n8n_data  │           │
│                               └───────────┘           │
└───────────────────────────────────────────────────────┘
              │
       https://localhost:8443
```

**With Cloudflare Tunnel:**
```
┌───────────────────────────────────────────────────────┐
│              OrbStack / Docker                        │
│   ┌─────────────────┐    ┌─────────────────────┐      │
│   │    Traefik      │───▶│        n8n          │      │
│   │   Port 8443     │    │     Port 5678       │      │
│   └─────────────────┘    └──────────┬──────────┘      │
│                                     │                 │
│   ┌─────────────────┐         ┌─────┴─────┐           │
│   │  cloudflared    │────────▶│ n8n_data  │           │
│   │  (CF Tunnel)    │         └───────────┘           │
│   └─────────────────┘                                 │
└───────────────────────────────────────────────────────┘
       │                    │
 https://n8n.example.com    https://localhost:8443
    (external)                  (local)
```
