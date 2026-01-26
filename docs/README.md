# n8n Local Installer

One-command installer for n8n workflow automation on macOS with OrbStack. Includes GAMP5-style Installation Qualification (IQ) and Operational Qualification (OQ) tests with JUnit output for validated deployments.

## Quick Start

```bash
bunx @lekman/n8n-local-deploy install
```

After installation, access n8n at **https://localhost:8443**

Your browser will show a certificate warning (self-signed TLS). Click "Advanced" → "Proceed" to continue.

Requires [Bun](https://bun.sh) 1.0+ and [OrbStack](https://orbstack.dev) (or Docker Desktop).

## Documentation

- [Installation Guide](research/INSTALL.md) - Step-by-step setup instructions
- [Maintainers Guide](MAINTAINERS.md) - Development and contribution info
- [Quality Assurance](QA.md) - IQ/OQ test procedures and validation strategy
- [Changelog](../packages/installer/CHANGELOG.md) - Release history and changes
