# n8n Local Installer

[![npm version](https://img.shields.io/npm/v/@lekman/n8n-local-deploy)](https://www.npmjs.com/package/@lekman/n8n-local-deploy)

One-command installer for n8n workflow automation on macOS with OrbStack. Includes GAMP5-style Installation Qualification (IQ) and Operational Qualification (OQ) tests with JUnit output for validated deployments.

## Quick Start

Requires [Bun](https://bun.sh) 1.0+ and [OrbStack](https://orbstack.dev) (or Docker Desktop).

### 1. Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **My Profile** → **API Tokens**
2. Click **Create Token** → **Create Custom Token**
3. Set permissions:
   - **Zone / Zone / Read**
   - **Zone / DNS / Edit**
   - **Account / Cloudflare Tunnel / Edit**
4. Set zone resources to your domain
5. Copy the token (shown only once)

### 2. Install n8n

```bash
bunx @lekman/n8n-local-deploy install
```

The installer will prompt for your Cloudflare token and domain.

**Local only (no tunnel):**
```bash
bunx @lekman/n8n-local-deploy install --local
```

After installation, access n8n using configured tunnel, or locally at **https://localhost:8443**

Your browser may show a certificate warning for local access (self-signed TLS). Click "Advanced" → "Proceed" to continue.

## Always-On Server (Optional)

If you're running n8n on a Mac that should stay awake 24/7, disable sleep and Power Nap to prevent containers from being suspended:

```bash
sudo pmset -c sleep 0 standby 0 powernap 0 disksleep 0
```

Verify settings with `pmset -g`. The values should show `0` for each.

## Documentation

- [Installation Guide](research/INSTALL.md) - Step-by-step setup instructions
- [Maintainers Guide](MAINTAINERS.md) - Development and contribution info
- [Quality Assurance](QA.md) - IQ/OQ test procedures and validation strategy
- [Changelog](../packages/installer/CHANGELOG.md) - Release history and changes
