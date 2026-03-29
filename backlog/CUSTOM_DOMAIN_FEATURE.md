# Feature Spec: Custom Domain for Chess Tracker

**Goal:** Two subdomains for the chess tracker:
- `chess.yourwebsite.com` → latest **stable** deployment (updated by `promote-stable.sh`)
- `betachess.yourwebsite.com` → latest **newest** deployment (updated automatically by `deploy.sh`)

Users never need to know or update a Google Apps Script URL.

**Status:** Spec / Not Started  
**Created:** 2026-03-28

---

## Problem

Google Apps Script generates a unique URL per deployment:
```
https://script.google.com/macros/s/AKfycbw.../exec
```

Every `./deploy.sh` run creates a new deployment with a new URL. Users currently must:
1. Receive a new URL each time the app is updated
2. Update bookmarks or lose access to the latest version
3. Potentially land on stale deployments

The `.stable-deployment` pinning mechanism protects rollback URLs but doesn't solve the user-facing discovery problem.

---

## Constraints

- **GAS does not support custom domains.** You cannot CNAME directly to `script.google.com`.
- Any solution requires an intermediary that maps a custom subdomain → current GAS deployment URL.
- The redirect target changes on each stable promotion, so the intermediary must be updatable.

---

## Infrastructure

- The website runs on **nginx** on a **Digital Ocean droplet**
- Website repo is **private** with version-controlled nginx config at `docs/nginx.config`
- **GitHub Actions CI/CD**: pushes to `main` → rsync site files → scp nginx config → `nginx -t && systemctl reload nginx`
- SSH credentials stored as GitHub Secrets: `DIGITALOCEAN_DROPLET_USERNAME`, `DIGITALOCEAN_DROPLET_IP`, `DIGITALOCEAN_SSH_KEY`
- **Certbot / Let's Encrypt** already configured
- The CI pipeline deploys the nginx config on every push

---

## Approach: nginx 302 Redirect on Existing Droplet

Since nginx already serves the main site, the simplest approach is a **separate nginx server block** for the chess subdomain that does a 302 redirect. The redirect URL is stored in a small file on the droplet that `promote-stable.sh` updates via SSH.

### Why nginx redirect?

| Criteria | nginx redirect | GitHub Pages | JS redirect |
|---|---|---|---|
| Redirect type | True HTTP 302 | JS `location.replace` | JS `location.replace` |
| Latency | ~5ms (server-level) | ~50ms (page load + JS) | ~50ms |
| Extra infrastructure | None (reuse droplet) | Separate repo + GH Pages | Separate hosting |
| HTTPS | Certbot (already available) | GitHub auto-cert | Depends on host |
| Update mechanism | SSH + file write + nginx reload | Git push | Git push / API |
| Maintenance | Minimal | Extra repo to manage | Extra repo to manage |

**nginx is the clear winner** — zero new infrastructure, true HTTP redirect, sub-10ms response.

### Architecture

```
chess.yourwebsite.com            betachess.yourwebsite.com
       │                                │
       ▼                                ▼
   DO Droplet / nginx               DO Droplet / nginx
   302 → {STABLE_ID}/exec           302 → {LATEST_ID}/exec
       │                                │
       ▼                                ▼
   GAS stable deployment             GAS newest deployment
```

| Subdomain | Points to | Updated by |
|---|---|---|
| `chess.yourwebsite.com` (stable) | Stable (tested) deployment | `promote-stable.sh` (manual) |
| `betachess.yourwebsite.com` (beta) | Newest deployment | `deploy.sh` (automatic) |

---

## Implementation Plan

### Phase 1: DNS Records

Add A records for both subdomains pointing to the droplet. In **Namecheap**: Domain List → Manage → Advanced DNS → Add New Record:

```
Type:  A Record
Host:  ct
Value: <droplet-ip>   (same IP as @ record)
TTL:   Automatic

Type:  A Record
Host:  bct
Value: <droplet-ip>
TTL:   Automatic
```

### Phase 2: nginx Config in Website Repo

The existing site's nginx config lives at `docs/nginx.config` and is deployed via GitHub Actions. The chess subdomain needs its own config file.

**Files to add/modify in the website repo:**

#### 2a. New file: `docs/ct.carlosiflores.com.nginx`

Handles **both** subdomains. Uses `include` to read the redirect URLs from snippet files on the droplet, so promotions don't require touching the version-controlled config.

```nginx
# ct.carlosiflores.com — stable Chess Tracker redirect
# bct.carlosiflores.com — latest (beta) Chess Tracker redirect
# Redirect URLs managed via the update-chess-redirect GitHub Action

# HTTP → HTTPS redirect (both subdomains)
server {
    listen 80;
    listen [::]:80;
    server_name ct.carlosiflores.com bct.carlosiflores.com;

    # Allow Certbot HTTP-01 challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS — ct.carlosiflores.com (stable)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ct.carlosiflores.com;

    http2 on;

    ssl_certificate     /etc/letsencrypt/live/ct.carlosiflores.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ct.carlosiflores.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Variable defined via map in /etc/nginx/conf.d/chess-tracker-redirect-url.conf (auto-included at http level)

    location / {
        return 302 $chess_tracker_redirect_url;
    }
}

# HTTPS — bct.carlosiflores.com (latest/beta)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name bct.carlosiflores.com;

    http2 on;

    ssl_certificate     /etc/letsencrypt/live/ct.carlosiflores.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ct.carlosiflores.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Variable defined via map in /etc/nginx/conf.d/beta-chess-tracker-redirect-url.conf (auto-included at http level)

    location / {
        return 302 $beta_chess_tracker_redirect_url;
    }
}
```

#### 2b. Redirect URL snippets (on droplet, NOT in git)

Two snippet files that the GitHub Action writes:

**`/etc/nginx/conf.d/chess-tracker-redirect-url.conf`** (stable):
```nginx
map "" $chess_tracker_redirect_url { default "https://script.google.com/macros/s/STABLE_DEPLOYMENT_ID/exec"; }
```

**`/etc/nginx/conf.d/beta-chess-tracker-redirect-url.conf`** (latest):
```nginx
map "" $beta_chess_tracker_redirect_url { default "https://script.google.com/macros/s/LATEST_DEPLOYMENT_ID/exec"; }
```

> **Why `map` instead of `set`?** The `set` directive is only valid inside `server`/`location` blocks, but `conf.d/` files are auto-included at the `http` level by nginx.conf. The `map "" $var { default "value"; }` idiom creates a constant variable at the `http` level.

This separation means updates only write a tiny conf snippet and reload nginx — the server block config is version-controlled and deployed via the normal CI pipeline.

#### 2c. Update `deploy.yml` in website repo

Add the chess nginx config to the existing deploy step:

```yaml
      - name: Deploy to DigitalOcean
        env:
          SSH_USER: ${{ secrets.DIGITALOCEAN_DROPLET_USERNAME }}
          SSH_HOST: ${{ secrets.DIGITALOCEAN_DROPLET_IP }}
          SSH_KEY: ${{ secrets.DIGITALOCEAN_SSH_KEY }}
        run: |
          # ... existing rsync ...
          scp docs/nginx.config $SSH_USER@$SSH_HOST:/tmp/carlosiflores.com.nginx
          scp docs/ct.carlosiflores.com.nginx $SSH_USER@$SSH_HOST:/tmp/ct.carlosiflores.com.nginx
          ssh $SSH_USER@$SSH_HOST "\
            sudo mv /tmp/carlosiflores.com.nginx /etc/nginx/sites-available/carlosiflores.com && \
            sudo mv /tmp/ct.carlosiflores.com.nginx /etc/nginx/sites-available/ct.carlosiflores.com && \
            sudo ln -sf /etc/nginx/sites-available/ct.carlosiflores.com /etc/nginx/sites-enabled/ct.carlosiflores.com && \
            sudo nginx -t && sudo systemctl reload nginx"
```

### Phase 3: GitHub Action — `update-chess-redirect.yml`

A GitHub Action in the website repo that accepts a redirect URL and a subdomain target (`ct` or `bct`), writes it to the droplet, and reloads nginx. Reuses existing SSH secrets — no local SSH keys needed.

Triggered by:
- `promote-stable.sh` with `subdomain=ct` (manual)
- `deploy.sh` with `subdomain=bct` (automatic, every deploy)
- GitHub UI as fallback

**New file: `.github/workflows/update-chess-redirect.yml`**

```yaml
name: Update Chess Redirect

on:
  workflow_dispatch:
    inputs:
      redirect_url:
        description: 'Full GAS deployment URL (https://script.google.com/macros/s/.../exec)'
        required: true
        type: string
      subdomain:
        description: 'Which subdomain to update'
        required: true
        type: choice
        options:
          - ct
          - bct
        default: ct

jobs:
  update-redirect:
    runs-on: ubuntu-latest

    steps:
      - name: Validate inputs
        run: |
          URL="${{ inputs.redirect_url }}"
          SUBDOMAIN="${{ inputs.subdomain }}"
          if [[ ! "$URL" =~ ^https://script\.google\.com/macros/s/AK[a-zA-Z0-9_-]+/exec$ ]]; then
            echo "❌ Invalid URL format. Expected: https://script.google.com/macros/s/AK.../exec"
            exit 1
          fi
          if [[ "$SUBDOMAIN" != "ct" && "$SUBDOMAIN" != "bct" ]]; then
            echo "❌ Invalid subdomain. Must be 'ct' or 'bct'"
            exit 1
          fi
          echo "✅ Updating $SUBDOMAIN.carlosiflores.com → $URL"

      - name: Update redirect on droplet
        env:
          SSH_USER: ${{ secrets.DIGITALOCEAN_DROPLET_USERNAME }}
          SSH_HOST: ${{ secrets.DIGITALOCEAN_DROPLET_IP }}
          SSH_KEY: ${{ secrets.DIGITALOCEAN_SSH_KEY }}
          REDIRECT_URL: ${{ inputs.redirect_url }}
          SUBDOMAIN: ${{ inputs.subdomain }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H $SSH_HOST >> ~/.ssh/known_hosts

          ssh $SSH_USER@$SSH_HOST bash -s -- "$REDIRECT_URL" "$SUBDOMAIN" <<'EOF'
          set -e
          REDIRECT_URL="$1"
          SUBDOMAIN="$2"

          if [ "$SUBDOMAIN" = "ct" ]; then
            CONF_FILE="/etc/nginx/conf.d/chess-tracker-redirect-url.conf"
            VAR_NAME="chess_tracker_redirect_url"
          else
            CONF_FILE="/etc/nginx/conf.d/beta-chess-tracker-redirect-url.conf"
            VAR_NAME="beta_chess_tracker_redirect_url"
          fi

          echo "map \"\" \$${VAR_NAME} { default \"${REDIRECT_URL}\"; }" | sudo tee "$CONF_FILE" > /dev/null
          sudo nginx -t
          sudo systemctl reload nginx

          echo "✅ ${SUBDOMAIN}.carlosiflores.com now redirects to: $REDIRECT_URL"
          EOF
```

This action:
1. Validates the URL matches the expected GAS pattern and subdomain is valid
2. SSHes to the droplet using existing `DIGITALOCEAN_*` secrets
3. Writes the correct redirect URL snippet based on subdomain
4. Validates and reloads nginx

### Phase 4: Certbot for Subdomains

After DNS propagates and the initial nginx HTTP config is deployed, issue TLS certs for both subdomains:

```bash
# SSH into the droplet — issue a cert covering both chess subdomains:
sudo certbot --nginx -d ct.carlosiflores.com -d bct.carlosiflores.com
```

Or expand the existing cert to include both:

```bash
sudo certbot --nginx --expand -d carlosiflores.com -d www.carlosiflores.com -d ct.carlosiflores.com -d bct.carlosiflores.com
```

Both HTTPS server blocks in the nginx config reference the same cert path (`/etc/letsencrypt/live/ct.carlosiflores.com/`), which works because Certbot stores multi-domain certs under the first domain's directory.

### Phase 5: Configuration File (chess-tracker repo)

Both `promote-stable.sh` and `deploy.sh` need to know the website repo and domain names. Since the chess-tracker repo is **public**, these values are externalized into a gitignored config file.

**New file: `.chess-redirect.conf.example`** (checked into git — template)

```bash
# Chess redirect configuration
# Copy to .chess-redirect.conf and fill in your values
# .chess-redirect.conf is gitignored — never committed

WEBSITE_REPO=""           # GitHub repo with redirect action (e.g. owner/repo)
WORKFLOW_FILE="update-chess-redirect.yml"
STABLE_DOMAIN=""          # Stable redirect subdomain (e.g. chess.yourwebsite.com)
BETA_DOMAIN=""            # Beta redirect subdomain (e.g. betachess.yourwebsite.com)
STABLE_SUBDOMAIN=""       # Subdomain key for GitHub Action (e.g. ct)
BETA_SUBDOMAIN=""         # Subdomain key for GitHub Action (e.g. bct)
```

**New file: `.chess-redirect.conf`** (gitignored — actual values)

```bash
WEBSITE_REPO="texican/personal-dot-com"
WORKFLOW_FILE="update-chess-redirect.yml"
STABLE_DOMAIN="ct.carlosiflores.com"
BETA_DOMAIN="bct.carlosiflores.com"
STABLE_SUBDOMAIN="ct"
BETA_SUBDOMAIN="bct"
```

**Add to `.gitignore`:**
```
.chess-redirect.conf
```

Both scripts source this file at startup and fail with a clear message if it's missing.

### Phase 6: promote-stable.sh (in chess-tracker repo)

A **separate script** in the chess-tracker repo. Does NOT run as part of `deploy.sh`. Triggers the GitHub Action from Phase 3 via the `gh` CLI.

**Prerequisites:** `gh` CLI installed and authenticated (`gh auth login`), `.chess-redirect.conf` populated.

```bash
#!/bin/bash
set -e

# ─── Load configuration ─────────────────────────────────────────
SCRIPT_DIR="$(dirname "$0")"
CONFIG_FILE="$SCRIPT_DIR/.chess-redirect.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Missing $CONFIG_FILE"
    echo "   Copy .chess-redirect.conf.example → .chess-redirect.conf and fill in values"
    exit 1
fi
source "$CONFIG_FILE"

if [ -z "$WEBSITE_REPO" ] || [ -z "$STABLE_DOMAIN" ] || [ -z "$STABLE_SUBDOMAIN" ]; then
    echo "❌ WEBSITE_REPO, STABLE_DOMAIN, and STABLE_SUBDOMAIN must be set in $CONFIG_FILE"
    exit 1
fi

WORKFLOW_FILE="${WORKFLOW_FILE:-update-chess-redirect.yml}"
STABLE_FILE="$SCRIPT_DIR/.stable-deployment"

# ─── Check gh CLI ────────────────────────────────────────────────
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is required. Install with: brew install gh"
    exit 1
fi

# ─── Resolve deployment to promote ───────────────────────────────
if [ -n "$1" ]; then
    PROMOTE_ID="$1"
    echo "♟️  Promoting specified deployment: $PROMOTE_ID"
else
    echo "♟️  Finding most recent deployment..."
    PROMOTE_ID=$(clasp deployments | grep -oE 'AK[a-zA-Z0-9_-]+' | tail -1)
    if [ -z "$PROMOTE_ID" ]; then
        echo "❌ Could not determine latest deployment ID"
        exit 1
    fi
    echo "📋 Most recent deployment: $PROMOTE_ID"
fi

STABLE_URL="https://script.google.com/macros/s/$PROMOTE_ID/exec"

# ─── Confirmation ────────────────────────────────────────────────
echo ""
echo "This will:"
echo "  1. Pin $PROMOTE_ID as the stable deployment"
echo "  2. Update $STABLE_DOMAIN → $STABLE_URL"
echo ""
read -p "Proceed? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# ─── Step 1: Update .stable-deployment locally ───────────────────
echo "$PROMOTE_ID" > "$STABLE_FILE"
echo "✅ Updated .stable-deployment → $PROMOTE_ID"

# ─── Step 2: Update LAST_STABLE_VERSION in Script Properties ─────
# Extract version number from clasp deployments output (e.g. @150)
VERSION_NUM=$(clasp deployments | grep "$PROMOTE_ID" | grep -oE '@[0-9]+' | tr -d '@')
if [ -n "$VERSION_NUM" ]; then
    echo "📋 Setting LAST_STABLE_VERSION → $VERSION_NUM"
    # Requires Apps Script Execution API enabled in GCP project
    clasp run adminSetStableVersion --params "[\"$VERSION_NUM\"]" 2>/dev/null \
        && echo "✅ LAST_STABLE_VERSION updated to $VERSION_NUM" \
        || echo "⚠️  Could not update LAST_STABLE_VERSION — update manually in admin panel"
else
    echo "⚠️  Could not determine version number — update LAST_STABLE_VERSION manually"
fi

# ─── Step 3: Trigger GitHub Action to update redirect ────────────
echo "🔗 Triggering redirect update via GitHub Actions..."
gh workflow run "$WORKFLOW_FILE" \
    --repo "$WEBSITE_REPO" \
    --field "redirect_url=$STABLE_URL" \
    --field "subdomain=$STABLE_SUBDOMAIN"

echo ""
echo "🎉 Promotion initiated!"
echo "   Stable ID:  $PROMOTE_ID"
echo "   Public URL:  https://$STABLE_DOMAIN"
echo "   Redirect to: $STABLE_URL"
echo ""
echo "⏳ The GitHub Action is running — check status:"
echo "   gh run list --repo $WEBSITE_REPO --workflow $WORKFLOW_FILE --limit 1"
```

### Phase 7: deploy.sh Update (chessbeta auto-update)

Add a step at the end of `deploy.sh` that triggers the GitHub Action to update the beta subdomain with the newly created deployment. Uses the same `.chess-redirect.conf` config file.

```bash
# ─── Update beta redirect ────────────────────────────────────────
CHESS_CONFIG="$(dirname "$0")/.chess-redirect.conf"
if [ -f "$CHESS_CONFIG" ]; then
    source "$CHESS_CONFIG"
    BETA_DOMAIN="${BETA_DOMAIN:-}"
    BETA_SUBDOMAIN="${BETA_SUBDOMAIN:-}"
    WEBSITE_REPO="${WEBSITE_REPO:-}"
    WORKFLOW_FILE="${WORKFLOW_FILE:-update-chess-redirect.yml}"

    if [ -n "$WEBSITE_REPO" ] && [ -n "$BETA_DOMAIN" ] && [ -n "$BETA_SUBDOMAIN" ] && command -v gh &> /dev/null; then
        echo "🔗 Updating $BETA_DOMAIN → new deployment..."
        gh workflow run "$WORKFLOW_FILE" \
            --repo "$WEBSITE_REPO" \
            --field "redirect_url=$WEB_APP_URL" \
            --field "subdomain=$BETA_SUBDOMAIN" \
            && echo "✅ $BETA_DOMAIN will update shortly (~30s)" \
            || echo "⚠️  Failed to trigger redirect update — $BETA_DOMAIN not updated"
    elif ! command -v gh &> /dev/null; then
        echo "⚠️  gh CLI not found — beta redirect not updated"
        echo "   Install with: brew install gh"
    fi
else
    echo "ℹ️  No .chess-redirect.conf — skipping beta redirect update"
fi
```

This is non-blocking — if `gh` isn't installed or the trigger fails, `deploy.sh` still succeeds.

### Phase 8: Initial Bootstrapping (One-Time)

On the droplet, create the initial redirect URL confs and enable the site:

```bash
# Create the initial redirect URL snippets
echo 'map "" $chess_tracker_redirect_url { default "https://script.google.com/macros/s/INITIAL_STABLE_ID/exec"; }' \
  | sudo tee /etc/nginx/conf.d/chess-tracker-redirect-url.conf

echo 'map "" $beta_chess_tracker_redirect_url { default "https://script.google.com/macros/s/INITIAL_LATEST_ID/exec"; }' \
  | sudo tee /etc/nginx/conf.d/beta-chess-tracker-redirect-url.conf

# Enable the site (the config file will be deployed by CI)
sudo ln -sf /etc/nginx/sites-available/ct.carlosiflores.com \
            /etc/nginx/sites-enabled/ct.carlosiflores.com

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## Workflow

### Step 1: Deploy
```bash
./deploy.sh
# → Pushes code to GAS
# → Creates new deployment with unique URL
# → Opens URL in browser for testing
# → Automatically updates betachess.yourwebsite.com → new deployment
# → Does NOT touch chess.yourwebsite.com (stable)
```

### Step 2: Test via Beta URL
```
https://betachess.yourwebsite.com
# → Always points to the latest deployment
# → Use this to verify the new version works correctly
```

### Step 3: Promote to Stable
```bash
# After testing the new deployment:
./promote-stable.sh
# → Pins latest deployment as stable in .stable-deployment
# → Triggers GitHub Action to update chess.yourwebsite.com
# → chess.yourwebsite.com now points to the tested version (~30s)

# Or promote a specific deployment:
./promote-stable.sh AKfycbw_specific_deployment_id
```

### Rollback
```bash
# Promote a previous deployment ID to stable
./promote-stable.sh AKfycbw_previous_stable_id
```

### Alternative: Trigger from GitHub UI

The action can also be triggered directly from the GitHub UI:
1. Go to the website repo → Actions → "Update Chess Redirect"
2. Click "Run workflow"
3. Select subdomain (`ct` or `bct`)
4. Paste the GAS deployment URL
5. Click "Run workflow"

This provides a fallback if `gh` CLI isn't available or for quick fixes from any device.

---

## Why GitHub Action Instead of Direct SSH

| Concern | Direct SSH | GitHub Action |
|---|---|---|
| Local SSH keys to droplet | Required | Not needed |
| Credential management | Local `~/.ssh` | Existing GitHub Secrets |
| Works from any machine | Only configured machines | Anywhere with `gh` or browser |
| Extra latency | ~1s (direct SSH) | ~30s (action runner spin-up) |
| Audit trail | Local terminal history | GitHub Actions run log |
| Failure visibility | Terminal output only | GitHub UI + email notifications |

The GitHub Action approach is better because:
- **No new credentials** — reuses the `DIGITALOCEAN_*` secrets already configured
- **Portable** — `promote-stable.sh` works on any machine with `gh` auth, no SSH key setup
- **Auditable** — every redirect update is logged as a GitHub Actions run
- **Browser fallback** — can promote from GitHub UI in an emergency

---

## User Experience

### Before
1. Owner deploys → gets new URL
2. Owner shares URL with players via text/chat
3. Players update bookmarks
4. Old bookmarks may serve stale version

### After
1. Owner deploys → beta subdomain auto-updates, owner tests there
2. Owner runs `./promote-stable.sh` once satisfied
3. Players always use `chess.yourwebsite.com` (stable)
4. Owner can share `betachess.yourwebsite.com` for preview/testing
5. No bookmark changes ever needed

### What Users See
1. Navigate to `https://chess.yourwebsite.com` (or `betachess.`)
2. Instant 302 redirect (~5ms, no visible page flash)
3. Land on the GAS-hosted chess tracker
4. URL bar shows `script.google.com/macros/s/.../exec` (unavoidable with GAS)

---

## Alternative Considered: iframe Embed (Not Recommended)

Instead of redirecting, serve the GAS app inside an iframe on the nginx server:
```html
<iframe src="DEPLOYMENT_URL" style="width:100%;height:100vh;border:none;"></iframe>
```

**Pros:** URL bar stays at `chess.yourwebsite.com`  
**Cons:** Breaks GAS auth flows, mobile UX issues, service worker conflicts, double scroll bars, `X-Frame-Options` may block it entirely. **Not recommended.**

---

## Open Questions

1. **Admin panel URL indicator** — Should the admin panel show the public URL and current stable deployment ID?

---

## Acceptance Criteria

**DNS & nginx:**
- [ ] DNS A records for both subdomains → droplet IP
- [ ] nginx server block config in website repo handles both subdomains
- [ ] `deploy.yml` in website repo deploys the chess nginx config alongside the main one
- [ ] HTTPS works for both subdomains via Let's Encrypt certificate (Certbot)

**GitHub Action:**
- [ ] `update-chess-redirect.yml` accepts `redirect_url` and `subdomain` inputs
- [ ] Action validates URL format and subdomain before applying
- [ ] Action writes correct snippet file based on subdomain
- [ ] Action can be triggered from GitHub UI as fallback

**Stable promotion:**
- [ ] `promote-stable.sh` triggers GitHub Action with configured stable subdomain
- [ ] `promote-stable.sh` updates `.stable-deployment` locally
- [ ] Confirmation prompt before promoting
- [ ] Explicit rollback supported (`./promote-stable.sh <old-id>`)

**Beta auto-update:**
- [ ] `deploy.sh` triggers GitHub Action with configured beta subdomain as final step
- [ ] Beta update is non-blocking — deploy succeeds even if trigger fails
- [ ] `gh` CLI absence produces a warning, not a failure

**General:**
- [ ] Old direct GAS URLs continue to work (no breaking change)
- [ ] README documents the custom domain setup and workflow
- [ ] `.chess-redirect.conf.example` checked in with empty placeholder values
- [ ] `.chess-redirect.conf` is gitignored (no personal info in committed code)
- [ ] Scripts fail gracefully with clear message if config file is missing

---

## Cross-Repo Changes Summary

| Repo | File | Change |
|---|---|---|
| website repo | `docs/ct.carlosiflores.com.nginx` | **New** — nginx server blocks for both chess subdomains |
| website repo | `.github/workflows/update-chess-redirect.yml` | **New** — action to update redirect URL (supports `ct` or `bct`) |
| website repo | `.github/workflows/deploy.yml` | **Modify** — scp + enable chess nginx config |
| `chess-tracker` | `.chess-redirect.conf.example` | **New** — template config with placeholder values (checked in) |
| `chess-tracker` | `.chess-redirect.conf` | **New** — actual config with domain/repo values (gitignored) |
| `chess-tracker` | `.gitignore` | **Modify** — add `.chess-redirect.conf` |
| `chess-tracker` | `promote-stable.sh` | **New** — script to promote stable + trigger action |
| `chess-tracker` | `deploy.sh` | **Modify** — add final step to trigger action for beta subdomain |
| `chess-tracker` | `README.md` | **Modify** — document custom domain + workflow |
| `chess-tracker` | `CLAUDE.md` | **Modify** — document promote-stable workflow |
| Droplet (one-time) | `/etc/nginx/conf.d/chess-tracker-redirect-url.conf` | **New** — initial stable redirect URL snippet |
| Droplet (one-time) | `/etc/nginx/conf.d/beta-chess-tracker-redirect-url.conf` | **New** — initial beta redirect URL snippet |
| DNS (one-time) | A records for both subdomains → droplet IP | **New** |
| Droplet (one-time) | Certbot | Issue cert for both chess subdomains |

---

## Effort Estimate

| Task | Effort |
|---|---|
| DNS A records for both subdomains | 5 min |
| Create chess subdomain nginx config (both server blocks) | 15 min |
| Create `update-chess-redirect.yml` GitHub Action (with subdomain param) | 15 min |
| Update `deploy.yml` to deploy chess nginx config | 10 min |
| Bootstrap both redirect URL snippets on droplet | 5 min |
| Certbot TLS certificate for both subdomains (+ DNS propagation) | 10-30 min |
| Write `promote-stable.sh` in chess-tracker | 15 min |
| Update `deploy.sh` with chessbeta auto-update step | 10 min |
| End-to-end testing (both subdomains) | 20 min |
| Documentation updates (README, CLAUDE.md) | 15 min |
| **Total** | **~2-2.5 hours** |
