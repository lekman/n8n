# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n Local Installer - CLI tool for deploying n8n workflow automation on macOS with OrbStack/Docker. Includes GAMP5-style Installation Qualification (IQ) and Operational Qualification (OQ) tests.

## Commands

All commands use go-task (`brew install go-task`). Run `task` for help.

```bash
# Installation
task i                    # Install n8n (alias for task install)
task i FORCE=1            # Force reinstall
task u                    # Uninstall
task s                    # Check status

# Testing
task t                    # Run all tests (IQ + OQ)
task iq                   # Run Installation Qualification tests only
task oq                   # Run Operational Qualification tests only

# Development
task tc                   # TypeScript type checking
bun run build             # Build installer (in packages/installer/)

# n8n Operations
task n8n:logs             # View container logs
task n8n:restart          # Restart container
task n8n:shell            # Shell into container
task n8n:open             # Open https://localhost:8443

# Linting (from ai-toolkit)
task yaml:lint            # Lint YAML files
task markdown:lint        # Lint markdown files
```

## Architecture

```
packages/installer/       # CLI tool (published to npm as @lekman/n8n-local-deploy)
  src/
    commands/             # install, uninstall, status commands
    services/             # docker.ts (container ops), config.ts (env generation)
    utils/                # logger with spinners and colors
  templates/              # docker-compose.yml template

tests/
  iq/                     # 8 Installation Qualification tests
  oq/                     # 8 Operational Qualification tests
  shared/                 # JUnit XML reporter

docker/n8n/               # Generated at runtime (not committed)
  docker-compose.yml      # Traefik + n8n configuration
  .env                    # N8N_ENCRYPTION_KEY and settings
```

## Key Technical Details

- **Runtime**: Bun (uses Bun-specific APIs like `$` shell, `Bun.sleep`)
- **Monorepo**: Bun workspaces with Turborepo for task caching
- **Port**: https://localhost:8443 (Traefik TLS termination with self-signed cert)
- **Tests**: Bun test runner with custom JUnit reporter for GAMP5 compliance
- **Releases**: release-please auto-generates changelog and version bumps

## Test Structure

IQ tests verify installation correctness (Docker running, files exist, containers started).
OQ tests verify operational functionality (health endpoint, API, webhooks, persistence).

Run a single test file:
```bash
bun test tests/iq/iq.test.ts
bun test tests/oq/oq.test.ts
```

JUnit reports output to `.logs/test-results/`.
