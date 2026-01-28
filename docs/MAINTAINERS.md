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

## CI/CD Pipelines

### Continuous Integration (ci.yml)

Runs on every push to `main` and on all pull requests targeting `main`. Validates code quality and build integrity.

**Validation Steps:**
1. **Lint Check** - Runs Biome linter to ensure code style compliance
2. **TypeScript Check** - Validates TypeScript types across the codebase
3. **Security Scan** - Runs Semgrep static analysis to detect security vulnerabilities
4. **Build Verification** - Compiles the installer package to ensure no build errors

**Requirements:**
- All checks must pass before PRs can be merged
- Uses Bun for fast dependency installation and execution
- Python 3.12 required for Semgrep security scanning

### Continuous Deployment (cd.yml)

Automatically publishes the installer package to npm when releases are created.

**Trigger Conditions:**
- Automatically: When a GitHub release is published
- Manually: Via workflow_dispatch with optional tag selection

**Deployment Steps:**
1. Checkout release tag
2. Install dependencies and run TypeScript checks
3. Build the installer package
4. Publish to npm registry as `@lekman/n8n-local-deploy`

**Requirements:**
- `NPM_TOKEN` secret must be configured in repository settings
- Only publishes from tagged releases
- Uses `--access public` for scoped package publishing

### Release Management (release.yml)

Automated release management using [release-please](https://github.com/googleapis/release-please).

**How It Works:**
1. Runs on every push to `main` branch
2. Analyzes commits using [Conventional Commits](https://www.conventionalcommits.org/) format
3. Automatically creates/updates a Release PR with:
   - Version bump based on commit types (feat = minor, fix = patch)
   - Updated CHANGELOG.md with categorized changes
   - Updated package.json version

**Changelog Sections:**
- `feat:` → Features
- `fix:` → Bug Fixes
- `perf:` → Performance
- `docs:` → Documentation
- `chore:`, `refactor:`, `test:`, `ci:` → Hidden from changelog

**Configuration:**
- `release-please-config.json` - Package configuration and changelog settings
- `.release-please-manifest.json` - Current version tracking

### Auto-Approval Workflow (auto-release.yml)

Automatically approves and merges release-please PRs that only contain version bump files.

**How It Works:**
1. Triggers after the Release workflow completes successfully
2. Finds open PRs with the `autorelease: pending` label
3. Verifies only allowed files changed:
   - `package.json` (version bumps)
   - `CHANGELOG.md` (release notes)
   - `.release-please-manifest.json` (version manifest)
4. Auto-approves the PR if validation passes
5. Enables auto-merge with squash strategy

**Safety Features:**
- Only processes PRs with specific release-please label
- Validates file changes to prevent unintended merges
- Rejects PRs with unexpected file changes
- Uses GitHub App token with minimal required permissions

**Result:**
- Release PRs are automatically merged once CI passes
- Triggers CD pipeline to publish to npm
- Fully automated release cycle from commit to npm publish

### NPM Publishing

Publishing happens automatically through the CD pipeline when:
1. A release-please PR is merged to `main`
2. GitHub automatically creates a release with the new version tag
3. The `cd.yml` workflow detects the new release
4. Package is built and published to npm as `@lekman/n8n-local-deploy`

**Manual Publishing:**
```bash
task qa                # Run all QA checks first
npm publish --access public -w packages/installer
```

## Claude Integration

This repository uses [Claude Code](https://claude.ai/code) for AI-assisted development. Maintainers and contributors can leverage Claude for implementation help, code reviews, and documentation.

### Using Claude on Issues

**Tag Claude for Implementation:**
Comment `@claude` on any issue to request implementation assistance. Claude will:
- Analyze the issue requirements
- Create a feature branch
- Implement the requested changes
- Provide a PR link for review

**Assign Issues to Claude:**
Assign issues directly to `@claude` for automatic implementation. Claude will begin work immediately upon assignment.

**Example Workflow:**
```markdown
## Issue: Add new validation test

@claude please implement IQ test for Cloudflare tunnel configuration
```

### Using Claude on Pull Requests

**Request Code Reviews:**
Tag `@claude` in a PR comment to request a thorough code review. Claude will analyze:
- Code quality and best practices
- Potential bugs or security issues
- Performance considerations
- Test coverage

**Automatic Review Requests:**
The PR template automatically requests Claude reviews by including `@claude` mention.

**Example Usage:**
```markdown
@claude please review this implementation for security concerns
```

### Best Practices

1. **Be Specific** - Provide clear requirements and context in issue descriptions
2. **Use Conventional Commits** - Claude follows the repository's commit conventions
3. **Review Claude's Work** - Always review PRs created by Claude before merging
4. **Iterate** - Tag Claude again on PRs to request changes or improvements

### Limitations

- Claude cannot approve PRs (security restriction)
- Claude cannot merge PRs (requires human approval)
- Complex multi-step features may require human guidance
