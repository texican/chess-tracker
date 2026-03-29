#!/bin/bash

# Chess Game Tracker - Promote a deployment to stable
# Updates .stable-deployment, LAST_STABLE_VERSION, and triggers
# the redirect update via GitHub Actions.
#
# Usage:
#   ./promote-stable.sh          # Show deployments, promote most recent
#   ./promote-stable.sh 150      # Promote by version number (@150)
#   ./promote-stable.sh AKfy...  # Promote by full deployment ID

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

# ─── Fetch deployments ───────────────────────────────────────────
DEPLOYMENTS_RAW=$(clasp deployments)

# Parse deployments into arrays (skip @HEAD)
declare -a DEP_IDS DEP_VERSIONS DEP_DESCS
while IFS= read -r line; do
    [[ $line =~ @HEAD ]] && continue
    if [[ $line =~ (AK[a-zA-Z0-9_-]+)[[:space:]]+@([0-9]+) ]]; then
        dep_id="${BASH_REMATCH[1]}"
        dep_ver="${BASH_REMATCH[2]}"
        # Extract description (everything after "- " at the end, or after the @version)
        desc=$(echo "$line" | sed -E 's/.*@[0-9]+ - //' | sed 's/^- //' | xargs)
        [[ "$desc" == "$line" ]] && desc=""
        DEP_IDS+=("$dep_id")
        DEP_VERSIONS+=("$dep_ver")
        DEP_DESCS+=("$desc")
    fi
done <<< "$DEPLOYMENTS_RAW"

if [ ${#DEP_IDS[@]} -eq 0 ]; then
    echo "❌ No deployments found"
    exit 1
fi

# ─── Show current stable ─────────────────────────────────────────
CURRENT_STABLE=""
if [ -f "$STABLE_FILE" ]; then
    CURRENT_STABLE=$(grep -v '^#' "$STABLE_FILE" | tr -d '[:space:]')
fi

echo ""
echo "♟️  Available deployments:"
echo "─────────────────────────────────────────────────────"

for i in "${!DEP_IDS[@]}"; do
    marker="  "
    if [ "${DEP_IDS[$i]}" = "$CURRENT_STABLE" ]; then
        marker="→ "
        label=" ← STABLE"
    else
        label=""
    fi
    desc="${DEP_DESCS[$i]}"
    if [ -n "$desc" ]; then
        printf "%s @%-4s  %s%s\n" "$marker" "${DEP_VERSIONS[$i]}" "$desc" "$label"
    else
        printf "%s @%-4s  %s%s\n" "$marker" "${DEP_VERSIONS[$i]}" "${DEP_IDS[$i]:0:20}..." "$label"
    fi
done

echo "─────────────────────────────────────────────────────"
echo ""

# ─── Resolve deployment to promote ───────────────────────────────
if [ -n "$1" ]; then
    INPUT="$1"

    # Check if input is a version number (digits only)
    if [[ "$INPUT" =~ ^[0-9]+$ ]]; then
        PROMOTE_ID=""
        PROMOTE_VER=""
        for i in "${!DEP_VERSIONS[@]}"; do
            if [ "${DEP_VERSIONS[$i]}" = "$INPUT" ]; then
                PROMOTE_ID="${DEP_IDS[$i]}"
                PROMOTE_VER="${DEP_VERSIONS[$i]}"
                break
            fi
        done
        if [ -z "$PROMOTE_ID" ]; then
            echo "❌ No deployment found for version @$INPUT"
            echo "   Available versions: ${DEP_VERSIONS[*]}"
            exit 1
        fi
        echo "♟️  Promoting @$PROMOTE_VER → $PROMOTE_ID"
    elif [[ "$INPUT" =~ ^AK[a-zA-Z0-9_-]+$ ]]; then
        PROMOTE_ID="$INPUT"
        # Find version number for this ID
        PROMOTE_VER=""
        for i in "${!DEP_IDS[@]}"; do
            if [ "${DEP_IDS[$i]}" = "$INPUT" ]; then
                PROMOTE_VER="${DEP_VERSIONS[$i]}"
                break
            fi
        done
        echo "♟️  Promoting specified deployment: $PROMOTE_ID"
    else
        echo "❌ Invalid argument: $INPUT"
        echo "   Pass a version number (e.g. 150) or a full deployment ID (AK...)"
        exit 1
    fi
else
    # Prompt for version number
    read -p "Enter version to promote (e.g. 150): " INPUT
    echo ""
    if [ -z "$INPUT" ]; then
        echo "Aborted."
        exit 0
    fi

    if [[ "$INPUT" =~ ^[0-9]+$ ]]; then
        PROMOTE_ID=""
        PROMOTE_VER=""
        for i in "${!DEP_VERSIONS[@]}"; do
            if [ "${DEP_VERSIONS[$i]}" = "$INPUT" ]; then
                PROMOTE_ID="${DEP_IDS[$i]}"
                PROMOTE_VER="${DEP_VERSIONS[$i]}"
                break
            fi
        done
        if [ -z "$PROMOTE_ID" ]; then
            echo "❌ No deployment found for version @$INPUT"
            echo "   Available versions: ${DEP_VERSIONS[*]}"
            exit 1
        fi
    elif [[ "$INPUT" =~ ^AK[a-zA-Z0-9_-]+$ ]]; then
        PROMOTE_ID="$INPUT"
        PROMOTE_VER=""
        for i in "${!DEP_IDS[@]}"; do
            if [ "${DEP_IDS[$i]}" = "$INPUT" ]; then
                PROMOTE_VER="${DEP_VERSIONS[$i]}"
                break
            fi
        done
    else
        echo "❌ Invalid input: $INPUT"
        echo "   Enter a version number (e.g. 150) or a full deployment ID (AK...)"
        exit 1
    fi
    echo "♟️  Promoting @$PROMOTE_VER"
fi

# Check if already stable
if [ "$PROMOTE_ID" = "$CURRENT_STABLE" ]; then
    echo "ℹ️  @$PROMOTE_VER is already the stable deployment. Nothing to do."
    exit 0
fi

STABLE_URL="https://script.google.com/macros/s/$PROMOTE_ID/exec"

# ─── Confirmation ────────────────────────────────────────────────
CURRENT_VER=""
if [ -n "$CURRENT_STABLE" ]; then
    for i in "${!DEP_IDS[@]}"; do
        if [ "${DEP_IDS[$i]}" = "$CURRENT_STABLE" ]; then
            CURRENT_VER="${DEP_VERSIONS[$i]}"
            break
        fi
    done
fi

echo ""
echo "This will:"
if [ -n "$CURRENT_VER" ]; then
    echo "  Promote @$PROMOTE_VER to stable (currently @$CURRENT_VER)"
else
    echo "  Promote @$PROMOTE_VER to stable"
fi
echo "  Update $STABLE_DOMAIN → new deployment"
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

# ─── Step 2: Update Script Properties ─────────────────────────────
# Set STABLE_DEPLOYMENT_ID (used for beta detection in doGet)
echo "📋 Setting STABLE_DEPLOYMENT_ID → $PROMOTE_ID"
clasp run adminSetStableDeploymentId --params "[\"$PROMOTE_ID\"]" 2>/dev/null \
    && echo "✅ STABLE_DEPLOYMENT_ID updated" \
    || echo "⚠️  Could not update STABLE_DEPLOYMENT_ID — beta tag may not appear"

# Set LAST_STABLE_VERSION from the version we already resolved
if [ -n "$PROMOTE_VER" ]; then
    echo "📋 Setting LAST_STABLE_VERSION → $PROMOTE_VER"
    # Requires Apps Script Execution API enabled in GCP project
    clasp run adminSetStableVersion --params "[\"$PROMOTE_VER\"]" 2>/dev/null \
        && echo "✅ LAST_STABLE_VERSION updated to $PROMOTE_VER" \
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
echo "   Stable:      @$PROMOTE_VER ($PROMOTE_ID)"
echo "   Public URL:  https://$STABLE_DOMAIN"
echo "   Redirect to: $STABLE_URL"
echo ""
echo "⏳ The GitHub Action is running — check status:"
echo "   gh run list --repo $WEBSITE_REPO --workflow $WORKFLOW_FILE --limit 1"
