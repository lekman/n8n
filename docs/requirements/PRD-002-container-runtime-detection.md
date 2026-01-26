# PRD-002: Container Runtime Detection and Auto-Installation

| Field | Value |
|-------|-------|
| **Document Owner** | Tobias Lekman |
| **Status** | Draft |
| **Created** | 2026-01-26 |
| **Target Release** | v0.2.0 |

## Problem Statement

The current installer assumes OrbStack is pre-installed and running. Users without OrbStack see cryptic Docker errors instead of helpful guidance. This creates friction for new users who want a true "one-command" experience.

### Current Behavior

```
$ bunx @lekman/n8n-local-deploy install
Error: Cannot connect to Docker daemon
```

### Target Behavior

```
$ bunx @lekman/n8n-local-deploy install

Checking container runtime...
  OrbStack: Not installed
  Docker Desktop: Not installed

No container runtime found. OrbStack is recommended for Mac.

? Install OrbStack via Homebrew? (Y/n) Y

Installing OrbStack...
  brew install orbstack
  ✓ OrbStack installed

Starting OrbStack...
  ✓ OrbStack is ready

Proceeding with n8n installation...
```

## Goals

1. **Zero-prerequisite installation** - Users run one command, installer handles the rest
2. **Prefer OrbStack** - Better performance, lower resource usage on macOS
3. **Docker Desktop fallback** - Support users who already have Docker installed
4. **Clear communication** - Users understand what's happening and why

## Non-Goals

- Linux support (future PRD)
- Windows support (future PRD)
- Podman support
- Remote Docker hosts

## Functional Requirements

### FR-1: Runtime Detection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Detect if OrbStack is installed via `which orb` or `/Applications/OrbStack.app` | Must Have |
| FR-1.2 | Detect if OrbStack daemon is running via `orb status` or `docker info` | Must Have |
| FR-1.3 | Detect if Docker Desktop is installed via `which docker` or `/Applications/Docker.app` | Must Have |
| FR-1.4 | Detect if Docker daemon is running via `docker info` | Must Have |
| FR-1.5 | Distinguish between "not installed" and "installed but not running" | Must Have |

### FR-2: Auto-Installation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Detect if Homebrew is available via `which brew` | Must Have |
| FR-2.2 | Offer to install OrbStack via `brew install orbstack` | Must Have |
| FR-2.3 | Display installation progress with spinner | Should Have |
| FR-2.4 | Handle Homebrew installation failure gracefully | Must Have |
| FR-2.5 | Provide manual installation instructions if Homebrew unavailable | Must Have |

### FR-3: Runtime Startup

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Start OrbStack if installed but not running via `orb start` or open app | Must Have |
| FR-3.2 | Start Docker Desktop if installed but not running via `open -a Docker` | Must Have |
| FR-3.3 | Wait for daemon to be ready with configurable timeout (default 60s) | Must Have |
| FR-3.4 | Poll daemon status every 2 seconds during startup wait | Should Have |
| FR-3.5 | Display countdown/progress during startup wait | Should Have |

### FR-4: User Experience

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Skip detection if `docker info` succeeds immediately | Must Have |
| FR-4.2 | Allow `--runtime orbstack` or `--runtime docker` to force choice | Should Have |
| FR-4.3 | Allow `--yes` flag to auto-accept OrbStack installation | Should Have |
| FR-4.4 | Remember runtime preference in config file for future runs | Could Have |

## Technical Design

### Detection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Start Installation                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  docker info    │
                    │   succeeds?     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ Yes                         │ No
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ Runtime ready,  │          │ Check OrbStack  │
    │ continue        │          │ installed?      │
    └─────────────────┘          └────────┬────────┘
                                          │
                          ┌───────────────┴───────────────┐
                          │ Yes                           │ No
                          ▼                               ▼
               ┌─────────────────┐             ┌─────────────────┐
               │ Start OrbStack  │             │ Check Docker    │
               │ wait for ready  │             │ Desktop?        │
               └─────────────────┘             └────────┬────────┘
                                                        │
                                        ┌───────────────┴───────────────┐
                                        │ Yes                           │ No
                                        ▼                               ▼
                             ┌─────────────────┐             ┌─────────────────┐
                             │ Start Docker    │             │ Offer OrbStack  │
                             │ wait for ready  │             │ installation    │
                             └─────────────────┘             └─────────────────┘
```

### New Service: RuntimeService

```typescript
// packages/installer/src/services/runtime.ts

interface RuntimeStatus {
  orbstack: {
    installed: boolean;
    running: boolean;
    version?: string;
  };
  docker: {
    installed: boolean;
    running: boolean;
    version?: string;
  };
  homebrew: {
    installed: boolean;
  };
}

interface RuntimeService {
  detect(): Promise<RuntimeStatus>;
  installOrbStack(): Promise<void>;
  startOrbStack(): Promise<void>;
  startDocker(): Promise<void>;
  waitForReady(timeout: number): Promise<void>;
}
```

### File Changes

| File | Change |
|------|--------|
| `packages/installer/src/services/runtime.ts` | New - Runtime detection and management |
| `packages/installer/src/commands/install.ts` | Modify - Add runtime check before Docker operations |
| `packages/installer/src/services/docker.ts` | Modify - Extract generic Docker operations |

## Test Cases

### IQ Tests (Installation Qualification)

| ID | Test Case | Acceptance Criteria |
|----|-----------|---------------------|
| IQ-RT-001 | OrbStack detection | Correctly identifies OrbStack installed/not installed |
| IQ-RT-002 | Docker detection | Correctly identifies Docker installed/not installed |
| IQ-RT-003 | Running state detection | Distinguishes installed from running |
| IQ-RT-004 | Homebrew detection | Correctly identifies Homebrew availability |

### OQ Tests (Operational Qualification)

| ID | Test Case | Acceptance Criteria |
|----|-----------|---------------------|
| OQ-RT-001 | OrbStack startup | OrbStack starts within 60s timeout |
| OQ-RT-002 | Docker startup | Docker starts within 60s timeout |
| OQ-RT-003 | Install flow | Full install succeeds from no-runtime state |

## Acceptance Criteria

1. User with no container runtime can complete installation with single command
2. User with stopped OrbStack sees it automatically started
3. User with stopped Docker Desktop sees it automatically started
4. User without Homebrew receives clear manual instructions
5. Installation succeeds within 2 minutes on typical Mac hardware
6. All existing IQ/OQ tests continue to pass

## Rollout Plan

1. Implement RuntimeService with detection logic
2. Add unit tests for detection (mocked)
3. Integrate into install command
4. Add IQ tests for runtime state
5. Manual testing on clean Mac VM
6. Release as v0.2.0

## Extended Scope: QA Automation with Husky

As part of this work, establish a pre-commit QA pipeline using Husky to ensure code quality and prevent regressions.

### FR-5: Pre-Commit Hooks

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Install Husky as dev dependency | Must Have |
| FR-5.2 | Pre-commit hook must check if n8n is installed, run installer if not | Must Have |
| FR-5.3 | Pre-commit hook must run IQ tests | Must Have |
| FR-5.4 | Pre-commit hook must run OQ tests | Must Have |
| FR-5.5 | Pre-commit hook must run TypeScript type checking | Must Have |
| FR-5.6 | Pre-commit hook must run Biome for linting and formatting | Must Have |
| FR-5.7 | Pre-commit hook must run Semgrep security scans | Must Have |
| FR-5.8 | Pre-commit hook must run dependency CVE audit (no high/critical) | Must Have |
| FR-5.9 | Allow `--no-verify` to bypass hooks for emergencies | Must Have |
| FR-5.10 | Hooks should fail fast on first error | Should Have |

### Pre-Commit Hook Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        git commit                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Check n8n      │
                    │  installed?     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ No                          │ Yes
              ▼                             │
    ┌─────────────────┐                     │
    │ Run installer   │                     │
    │ (auto mode)     │                     │
    └────────┬────────┘                     │
             │                              │
             └──────────────┬───────────────┘
                            ▼
                  ┌─────────────────┐
                  │  Biome lint     │──── Fail ──▶ Abort
                  │  & format check │
                  └────────┬────────┘
                           │ Pass
                           ▼
                  ┌─────────────────┐
                  │  TypeScript     │──── Fail ──▶ Abort
                  │  typecheck      │
                  └────────┬────────┘
                           │ Pass
                           ▼
                  ┌─────────────────┐
                  │  Semgrep        │──── Fail ──▶ Abort
                  │  security scan  │
                  └────────┬────────┘
                           │ Pass
                           ▼
                  ┌─────────────────┐
                  │  Dependency     │──── Fail ──▶ Abort
                  │  CVE audit      │
                  └────────┬────────┘
                           │ Pass
                           ▼
                  ┌─────────────────┐
                  │  IQ Tests       │──── Fail ──▶ Abort
                  └────────┬────────┘
                           │ Pass
                           ▼
                  ┌─────────────────┐
                  │  OQ Tests       │──── Fail ──▶ Abort
                  └────────┬────────┘
                           │ Pass
                           ▼
                  ┌─────────────────┐
                  │  Commit         │
                  │  proceeds       │
                  └─────────────────┘
```

### New Dependencies

| Package | Purpose |
|---------|---------|
| `husky` | Git hooks management |
| `@biomejs/biome` | Fast linter and formatter (replaces ESLint + Prettier) |
| `semgrep` | Security-focused static analysis (via CLI) |

### File Changes for QA Automation

| File | Change |
|------|--------|
| `package.json` | Add husky, biome, prepare script |
| `.husky/pre-commit` | New - Pre-commit hook script |
| `biome.json` | New - Biome configuration |
| `.semgrep.yml` | New - Semgrep rules configuration |
| `Taskfile.yml` | Add lint, format, security tasks |

### Biome Configuration

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": { "quoteStyle": "double" }
  }
}
```

### Semgrep Configuration

```yaml
# .semgrep.yml
rules:
  - id: no-hardcoded-secrets
    patterns:
      - pattern-regex: (api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+['"]
    message: Potential hardcoded secret detected
    severity: ERROR
    languages: [typescript, javascript]
```

### Pre-Commit Hook Script

```bash
#!/bin/sh
# .husky/pre-commit

set -e

echo "Running pre-commit checks..."

# Skip runtime checks in CI (auto-detected)
if [ -z "$CI" ]; then
  # Check if n8n is installed, install if not
  if ! docker compose -f docker/n8n/docker-compose.yml ps --quiet 2>/dev/null; then
    echo "n8n not detected, running installer..."
    bun run install:n8n --yes
  fi
fi

# Run parallel checks (lint, typecheck, security, audit)
echo "Running static analysis checks in parallel..."
bun run lint &
PID_LINT=$!

bun run typecheck &
PID_TYPE=$!

bun run security &
PID_SEC=$!

bun run audit &
PID_AUDIT=$!

# Wait for all parallel checks
FAILED=0
wait $PID_LINT || FAILED=1
wait $PID_TYPE || FAILED=1
wait $PID_SEC || FAILED=1
wait $PID_AUDIT || FAILED=1

if [ $FAILED -ne 0 ]; then
  echo "Static analysis checks failed!"
  exit 1
fi

echo "Static analysis passed, running tests..."

# IQ Tests
echo "Running IQ tests..."
bun run test:iq

# OQ Tests
echo "Running OQ tests..."
bun run test:oq

echo "All checks passed!"
```

### Updated Test Matrix

| Test Type | Tool | Runs On | Threshold |
|-----------|------|---------|-----------|
| Lint | Biome | Pre-commit, CI | Zero errors |
| Format | Biome | Pre-commit, CI | Zero errors |
| Types | TypeScript | Pre-commit, CI | Zero errors |
| Security | Semgrep | Pre-commit, CI | Zero findings |
| CVE Audit | bun pm audit | Pre-commit, CI | No medium+ vulnerabilities |
| IQ | Bun test | Pre-commit, CI | 100% pass |
| OQ | Bun test | Pre-commit, CI | 100% pass |

## Decisions

| Question | Decision |
|----------|----------|
| `--skip-runtime-check` flag | GitHub Actions only (auto-detect via `CI` env var), never skip locally |
| Installation auto-start | CLI only, no app launch |
| OrbStack startup timeout | 60 seconds |
| Pre-commit hooks parallel | Yes, run lint/typecheck/security in parallel |
| Semgrep rules | Offline local rules only (no cloud dependency) |
