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
task install           # Install n8n to OrbStack
task uninstall         # Uninstall n8n from OrbStack
task status            # Check n8n installation status
```

**Testing:**
```bash
task test              # Run all validation tests (IQ + OQ) - alias: t
task test:iq           # Run Installation Qualification tests
task test:oq           # Run Operational Qualification tests
```

**Development:**
```bash
task typecheck         # Run TypeScript type checking
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

1. Update version in `package.json` and `packages/installer/package.json`
2. Run all tests and ensure they pass
3. Create a git tag matching the version
4. Publish to npm: `npm publish --access public`

## Code Style

- TypeScript with strict mode
- ESM modules (`"type": "module"`)
- Bun runtime for development and testing
