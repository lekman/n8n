# Maintainers

## Primary Contact

- **Tobias Lekman** ([@lekman](https://github.com/lekman))

## Repository Structure

```
packages/installer/    CLI installer source code
docker/n8n/            Generated deployment files (not committed)
tests/iq/              Installation Qualification tests
tests/oq/              Operational Qualification tests
tests/shared/          Shared test utilities (JUnit reporter)
scripts/tasks/         Custom Taskfile definitions
docs/                  Documentation
```

## Task Runner (go-task)

This project uses [go-task](https://taskfile.dev) for task automation. Install it with:

```bash
# macOS
brew install go-task

# Or via npm
npm install -g @go-task/cli
```

### Available Commands

Run `task` or `task help` to see all available commands.

**Installation:**
```bash
task install           # Install n8n with Cloudflare Tunnel (alias: i)
task install:local     # Install for local access only (alias: il)
task uninstall         # Uninstall n8n (alias: u)
task status            # Check installation status (alias: s)
```

Cloudflare Tunnel options (default mode):
```bash
task i DOMAIN=example.com SUBDOMAIN=n8n
# Or set CLOUDFLARE_API_TOKEN env var to skip prompt
```

**Testing:**
```bash
task test              # Run all validation tests (IQ + OQ) - alias: t
task test:iq           # Run Installation Qualification tests
task test:oq           # Run Operational Qualification tests
```

**Development:**
```bash
task typecheck         # Run TypeScript type checking (alias: tc)
task lint              # Run Biome linter (alias: l)
task lint:fix          # Auto-fix lint issues (alias: lf)
task security          # Run Semgrep security scan (alias: sec)
task qa                # Run all QA checks (lint, typecheck, security, tests)
```

**n8n Operations:**
```bash
task n8n:logs          # View n8n container logs
task n8n:restart       # Restart n8n container
task n8n:shell         # Open shell in n8n container
task n8n:open          # Open n8n in browser
```

**Shared Task Libraries:**
```bash
task git:help          # Git operations
task yaml:help         # YAML linting & validation
task markdown:help     # Markdown linting & validation
```

## Development

```bash
bun install            # Install dependencies
bun run typecheck      # Run TypeScript checks
bun run status         # Test CLI locally
```

## Testing

Tests require n8n to be installed first:

```bash
bun run install:n8n    # Install n8n
bun run test:iq        # Run IQ tests
bun run test:oq        # Run OQ tests
bun run test:validate  # Run all tests with Turbo caching
```

JUnit reports are written to `.logs/test-results/`.

## Release Process

Releases are automated via [release-please](https://github.com/googleapis/release-please):

1. Merge PRs with [Conventional Commits](https://www.conventionalcommits.org/) format
2. release-please creates a Release PR with changelog updates
3. Merge the Release PR to trigger npm publish

**Manual release (if needed):**
```bash
task qa                # Ensure all checks pass
npm publish --access public -w packages/installer
```

## Code Style

- TypeScript with strict mode
- ESM modules (`"type": "module"`)
- Bun runtime for development and testing
