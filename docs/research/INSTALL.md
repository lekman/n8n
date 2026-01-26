# Installing n8n on Your Mac

This guide walks you through installing n8n on your Mac with secure internet access. No coding experience required.

**What you'll get:** A personal automation platform running on your Mac, accessible from anywhere at `https://n8n.yourdomain.com`.

**Time required:** About 15-20 minutes.

---

## Before You Start

You'll need:

1. **A Mac** running macOS 12 (Monterey) or newer
2. **A Cloudflare account** (free) with a domain you control
3. **Terminal access** (we'll show you how)

### Check Your macOS Version

1. Click the Apple menu () in the top-left corner
2. Select "About This Mac"
3. Look for the version number (should be 12.0 or higher)

### Opening Terminal

Terminal is where you'll type commands. Here's how to open it:

1. Press `Command + Space` to open Spotlight
2. Type `Terminal`
3. Press `Enter`

A window with a text prompt will appear. This is where you'll paste the commands in this guide.

---

## Step 1: Create a Cloudflare API Token

The installer needs permission to set up your domain. You'll create a special key (called an "API token") that grants this permission.

### 1.1 Log in to Cloudflare

Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign in.

### 1.2 Navigate to API Tokens

1. Click your **profile icon** in the top-right corner
2. Select **My Profile**
3. Click **API Tokens** in the left sidebar

### 1.3 Create a Custom Token

1. Click the blue **Create Token** button
2. Scroll down and click **Create Custom Token** (not the templates above)

### 1.4 Configure the Token

Fill in the form as follows:

**Token name:** `n8n-local-deploy`

**Permissions** (click "Add more" to add each one):

| Permission Group | Permission | Access |
|------------------|------------|--------|
| Account | Cloudflare Tunnel | Edit |
| Zone | DNS | Edit |
| Zone | Zone | Read |

**Account Resources:**
- Select: `Include` → `All accounts`

**Zone Resources:**
- Select: `Include` → `All zones`
- (Or select a specific zone if you prefer)

### 1.5 Create and Copy the Token

1. Click **Continue to summary**
2. Review the permissions
3. Click **Create Token**
4. **Important:** Copy the token immediately and save it somewhere safe (like a password manager)

> ⚠️ **You won't be able to see this token again.** If you lose it, you'll need to create a new one.

The token looks something like this:
```
Abc123XYZ_very_long_string_of_characters_here
```

---

## Step 2: Run the Installer

Now for the easy part. Paste this command into Terminal and press Enter:

```bash
bunx @lekman/n8n-local-deploy
```

**Don't have bun installed?** No problem. Use this instead:

```bash
npx @lekman/n8n-local-deploy
```

### What Happens Next

The installer will guide you through a few questions:

1. **Cloudflare API Token:** Paste the token you created in Step 1
2. **Domain selection:** Choose which of your domains to use
3. **Subdomain:** Enter what you want before your domain (e.g., `n8n` for `n8n.yourdomain.com`)

The installer will then:
- ✅ Check if you have Docker or OrbStack installed
- ✅ Offer to install OrbStack if needed (recommended)
- ✅ Create a secure tunnel to Cloudflare
- ✅ Set up your domain's DNS
- ✅ Start n8n

This takes 2-5 minutes depending on your internet connection.

### Expected Output

You should see something like this:

```
✔ Cloudflare API token validated
✔ Found 2 zones in your account
? Select a domain: lekman.com
? Enter subdomain for n8n: n8n
  Your n8n will be accessible at: https://n8n.lekman.com

✔ OrbStack detected and running
✔ Created Cloudflare Tunnel: n8n-tunnel-abc123
✔ Configured tunnel ingress rules
✔ Created DNS record: n8n.lekman.com
✔ Generated docker-compose.yml
✔ Starting containers...
✔ n8n is healthy and responding

🎉 Installation complete!

Your n8n instance is now running at:
   https://n8n.lekman.com

Next steps:
1. Open the URL above in your browser
2. Create your n8n account
3. Start building workflows!

Configuration saved to: ~/n8n-deployment/
```

---

## Step 3: Verify It's Working

### 3.1 Open n8n in Your Browser

Open your browser and go to the URL shown in the installer output (e.g., `https://n8n.lekman.com`).

You should see the n8n setup screen asking you to create an account.

### 3.2 Create Your n8n Account

1. Enter your email address
2. Choose a strong password
3. Complete the setup

That's it! You now have a fully functional n8n instance.

---

## Common Issues

### "Command not found: bunx" or "Command not found: npx"

You need Node.js installed. The easiest way:

1. Install Homebrew (if you don't have it):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Install Node.js:
   ```bash
   brew install node
   ```

3. Try the installer again.

### "Permission denied" errors

Try running with administrator privileges:
```bash
sudo bunx @lekman/n8n-local-deploy
```

Enter your Mac password when prompted.

### "Invalid API token" error

Double-check that:
- You copied the entire token (they're long!)
- The token has all three permissions listed in Step 1.4
- The token hasn't expired

### "Port 5678 is already in use"

Something else is using the port n8n needs. Either:
- Stop the other application
- The installer will offer an alternative port

### Site shows "DNS not found" or doesn't load

DNS changes can take a few minutes to spread across the internet. Wait 5-10 minutes and try again.

### OrbStack installation fails

If the automatic installation doesn't work:

1. Go to [orbstack.dev](https://orbstack.dev)
2. Download and install manually
3. Run the installer again

---

## Managing Your Installation

### Starting and Stopping n8n

The installer creates a folder at `~/n8n-deployment/`. Navigate there to manage your installation:

```bash
cd ~/n8n-deployment
```

**Stop n8n:**
```bash
docker compose down
```

**Start n8n:**
```bash
docker compose up -d
```

**View logs:**
```bash
docker compose logs -f
```

Press `Ctrl+C` to stop viewing logs.

### Updating n8n

To get the latest version of n8n:

```bash
cd ~/n8n-deployment
docker compose pull
docker compose up -d
```

### Backing Up Your Data

Your workflows and credentials are stored in a Docker volume. To back them up:

```bash
cd ~/n8n-deployment
docker run --rm -v n8n_data:/data -v $(pwd):/backup alpine tar czf /backup/n8n-backup.tar.gz /data
```

This creates a file called `n8n-backup.tar.gz` in your n8n-deployment folder.

### Restoring from Backup

```bash
cd ~/n8n-deployment
docker compose down
docker run --rm -v n8n_data:/data -v $(pwd):/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/n8n-backup.tar.gz -C /"
docker compose up -d
```

---

## Uninstalling

If you want to completely remove n8n:

```bash
bunx @lekman/n8n-local-deploy --uninstall
```

Or manually:

```bash
cd ~/n8n-deployment
docker compose down -v  # Stops containers and deletes data
cd ~
rm -rf ~/n8n-deployment
```

Note: This does not remove the Cloudflare tunnel or DNS record. To remove those:

1. Go to [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com)
2. Navigate to Networks → Tunnels
3. Delete the tunnel named like `n8n-tunnel-...`
4. Go to your domain's DNS settings and delete the n8n CNAME record

---

## Getting Help

- **n8n Documentation:** [docs.n8n.io](https://docs.n8n.io)
- **n8n Community Forum:** [community.n8n.io](https://community.n8n.io)
- **This Installer:** [github.com/lekman/n8n-local-deploy](https://github.com/lekman/n8n-local-deploy)

---

## Technical Details (Optional Reading)

For those interested, here's what the installer sets up:

### Architecture

```
Internet → Cloudflare Edge → Cloudflare Tunnel → Your Mac → n8n
```

- No ports are opened on your router or firewall
- All traffic is encrypted end-to-end
- Your Mac's IP address is never exposed

### Files Created

| File | Purpose |
|------|---------|
| `~/n8n-deployment/docker-compose.yml` | Defines the n8n and tunnel containers |
| `~/n8n-deployment/.env` | Stores configuration (domain, encryption key, tunnel token) |

### Container Runtime

The installer prefers **OrbStack** over Docker Desktop because:
- Starts in 2 seconds (vs 20-30 seconds)
- Uses 75% less power
- Automatically releases memory when not in use
- Optimised specifically for Mac

If you already have Docker Desktop, it works just as well.

---

*Last updated: January 2026*
