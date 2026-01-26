# n8n Local Installer

One-command installer for n8n workflow automation on macOS with OrbStack/Docker and Cloudflare Tunnel.

## Requirements

- [Bun](https://bun.sh) 1.0+
- [OrbStack](https://orbstack.dev) or Docker Desktop
- Cloudflare account with a domain

## 1. Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **My Profile** → **API Tokens**
2. Click **Create Token** → **Create Custom Token**
3. Set permissions:
   - **Zone / Zone / Read**
   - **Zone / DNS / Edit**
   - **Account / Cloudflare Tunnel / Edit**
4. Set zone resources to your domain
5. Copy the token (shown only once)

## 2. Install n8n

```bash
bunx @lekman/n8n-local-deploy install
```

The installer prompts for your Cloudflare token, domain, and subdomain.

**Non-interactive:**
```bash
CLOUDFLARE_API_TOKEN=your_token bunx @lekman/n8n-local-deploy install --domain example.com --subdomain n8n
```

After installation, access n8n at **https://your-subdomain.your-domain.com**

## Commands

```bash
bunx @lekman/n8n-local-deploy install    # Install with Cloudflare Tunnel
bunx @lekman/n8n-local-deploy status     # Check status
bunx @lekman/n8n-local-deploy uninstall  # Uninstall
```

## Options

| Option | Description |
|--------|-------------|
| `--force` | Force reinstall |
| `--domain <domain>` | Cloudflare domain |
| `--subdomain <name>` | Subdomain for n8n |
| `--yes` | Auto-accept prompts |

## License

MIT
