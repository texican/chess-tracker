#!/bin/bash

# Chess Game Tracker - Deploy to Google Apps Script
# This script uploads changes, redeploys, and opens the form

set -e  # Exit on any error

echo "♟️  Starting Chess Game Tracker deployment..."

# Check if we're in the correct directory
if [ ! -f "code.gs" ] || [ ! -f "index.html" ]; then
    echo "❌ Error: code.gs or index.html not found. Please run from the chess-tracker directory."
    exit 1
fi

# Check if clasp is installed
if ! command -v clasp &> /dev/null; then
    echo "❌ Error: Google Clasp is not installed. Install with: npm install -g @google/clasp"
    exit 1
fi

# Check if clasp is logged in
if ! clasp status &> /dev/null; then
    echo "❌ Error: Clasp is not logged in. Run: clasp login"
    exit 1
fi

# Require a clean git working tree so every deployment traces to a committed state
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ Error: Uncommitted changes detected. Commit or stash before deploying."
    git status --short
    exit 1
fi
GIT_HASH=$(git rev-parse --short HEAD)
echo "🔗 Git commit: $GIT_HASH"

# ─── Sync VERSION from CHANGELOG.md → code.gs ────────────────────
CHANGELOG_VERSION=$(grep -m1 -oE '\[[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | tr -d '[]')
if [ -n "$CHANGELOG_VERSION" ]; then
    CURRENT_VERSION=$(grep -m1 "const VERSION" code.gs | sed "s/.*'\\([^']*\\)'.*/\\1/")
    if [ "$CHANGELOG_VERSION" != "$CURRENT_VERSION" ]; then
        echo "📋 Syncing VERSION: $CURRENT_VERSION → $CHANGELOG_VERSION"
        sed -i '' "s/const VERSION = '.*'/const VERSION = '$CHANGELOG_VERSION'/" code.gs
        sed -i '' "s/^ \\* Version: .*/ * Version: $CHANGELOG_VERSION/" code.gs
        TODAY=$(date '+%Y-%m-%d')
        sed -i '' "s/const LAST_UPDATED = '.*'/const LAST_UPDATED = '$TODAY'/" code.gs
        sed -i '' "s/^ \\* Last Updated: .*/ * Last Updated: $TODAY/" code.gs
        # Amend the current commit with the version bump (tree is clean at this point)
        git add code.gs
        if ! git commit --amend --no-edit --quiet; then
            echo "❌ Failed to amend commit with version sync"
            git checkout HEAD -- code.gs
            exit 1
        fi
        GIT_HASH=$(git rev-parse --short HEAD)
        echo "🔗 Amended commit: $GIT_HASH"
    fi
    VERSION="$CHANGELOG_VERSION"
else
    VERSION=$(grep -m1 "const VERSION" code.gs | sed "s/.*'\\([^']*\\)'.*/\\1/" || echo "unknown")
fi

echo "📤 Pushing files to Google Apps Script..."
clasp push --force

echo "🧹 Cleaning up old deployments..."
# Get full deployment list with descriptions
DEPLOYMENTS_FULL=$(clasp deployments)

# Extract ALL deployment IDs (except @HEAD), with timestamps when available
declare -a DEPLOYMENT_DATA
while IFS= read -r line; do
    # Skip @HEAD deployment
    if [[ $line =~ @HEAD ]]; then
        continue
    fi
    # Match any deployment ID
    if [[ $line =~ (AK[a-zA-Z0-9_-]+) ]]; then
        dep_id="${BASH_REMATCH[1]}"
        # Try to extract a timestamp from the description
        if [[ $line =~ ([0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]][0-9]{2}:[0-9]{2}:[0-9]{2}) ]]; then
            timestamp="${BASH_REMATCH[1]}"
            epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "$timestamp" "+%s" 2>/dev/null || echo "0")
        else
            # No timestamp — treat as oldest (epoch=0) so it's cleaned up first
            timestamp="(no timestamp)"
            epoch="0"
        fi
        DEPLOYMENT_DATA+=("$epoch|$dep_id|$timestamp")
    fi
done <<< "$DEPLOYMENTS_FULL"

# Count deployments
DEPLOYMENT_COUNT=${#DEPLOYMENT_DATA[@]}
MIN_DEPLOYMENTS_BEFORE_CLEANUP=10

if [ "$DEPLOYMENT_COUNT" -gt "$MIN_DEPLOYMENTS_BEFORE_CLEANUP" ]; then
    echo "📊 Found $DEPLOYMENT_COUNT deployments (>${MIN_DEPLOYMENTS_BEFORE_CLEANUP}, cleanup needed)"

    # Sort by epoch (newest first)
    IFS=$'\n' SORTED_DEPLOYMENTS=($(sort -t'|' -k1 -rn <<<"${DEPLOYMENT_DATA[*]}"))
    unset IFS

    # Get the most recent deployment
    MOST_RECENT="${SORTED_DEPLOYMENTS[0]}"
    MOST_RECENT_EPOCH=$(echo "$MOST_RECENT" | cut -d'|' -f1)
    MOST_RECENT_ID=$(echo "$MOST_RECENT" | cut -d'|' -f2)
    MOST_RECENT_TIME=$(echo "$MOST_RECENT" | cut -d'|' -f3)

    echo "🔹 Most recent: $MOST_RECENT_ID ($MOST_RECENT_TIME)"

    # Check for a pinned stable deployment in .stable-deployment file
    STABLE_ID=""
    STABLE_TIME=""
    STABLE_SOURCE=""

    STABLE_FILE="$(dirname "$0")/.stable-deployment"
    if [ -f "$STABLE_FILE" ]; then
        PINNED_ID=$(grep -v '^#' "$STABLE_FILE" | tr -d '[:space:]')
        if [[ -n "$PINNED_ID" && "$PINNED_ID" =~ ^AK[a-zA-Z0-9_-]+$ ]]; then
            # Verify the pinned ID still exists in the deployment list
            for deployment in "${SORTED_DEPLOYMENTS[@]}"; do
                dep_id=$(echo "$deployment" | cut -d'|' -f2)
                timestamp=$(echo "$deployment" | cut -d'|' -f3)
                if [ "$dep_id" == "$PINNED_ID" ]; then
                    STABLE_ID="$PINNED_ID"
                    STABLE_TIME="$timestamp"
                    STABLE_SOURCE="pinned"
                    break
                fi
            done
            if [ -z "$STABLE_ID" ]; then
                echo "⚠️  Pinned stable deployment $PINNED_ID not found in current deployments — falling back to age-based selection"
            fi
        else
            echo "⚠️  .stable-deployment file contains invalid ID '$PINNED_ID' — falling back to age-based selection"
        fi
    fi

    # Fall back to 8-hour heuristic if no valid pinned stable
    if [ -z "$STABLE_ID" ]; then
        EIGHT_HOURS=28800
        for deployment in "${SORTED_DEPLOYMENTS[@]:1}"; do
            epoch=$(echo "$deployment" | cut -d'|' -f1)
            dep_id=$(echo "$deployment" | cut -d'|' -f2)
            timestamp=$(echo "$deployment" | cut -d'|' -f3)

            age_diff=$((MOST_RECENT_EPOCH - epoch))

            if [ "$age_diff" -ge "$EIGHT_HOURS" ]; then
                STABLE_ID="$dep_id"
                STABLE_TIME="$timestamp"
                STABLE_SOURCE="age-based ($((age_diff / 3600))h older)"
                break
            fi
        done
    fi

    if [ -n "$STABLE_ID" ]; then
        echo "🔒 Stable version: $STABLE_ID ($STABLE_TIME) [$STABLE_SOURCE]"
    fi

    # Build list of deployment IDs to keep: latest patch version for each minor version
    # Extract version from description: "Chess Tracker v2.7.0 - ..." → "2.7"
    declare -A MINOR_VERSION_BEST  # minor_version -> "epoch|dep_id"
    for deployment in "${SORTED_DEPLOYMENTS[@]}"; do
        epoch=$(echo "$deployment" | cut -d'|' -f1)
        dep_id=$(echo "$deployment" | cut -d'|' -f2)

        # Find version in original deployment output
        desc_line=$(echo "$DEPLOYMENTS_FULL" | grep "$dep_id" || true)
        if [[ $desc_line =~ v([0-9]+\.[0-9]+)\.[0-9]+ ]]; then
            minor_ver="${BASH_REMATCH[1]}"
            # Keep the one with highest epoch (most recent) for this minor version
            if [ -z "${MINOR_VERSION_BEST[$minor_ver]}" ]; then
                MINOR_VERSION_BEST[$minor_ver]="$epoch|$dep_id"
            else
                existing_epoch=$(echo "${MINOR_VERSION_BEST[$minor_ver]}" | cut -d'|' -f1)
                if [ "$epoch" -gt "$existing_epoch" ]; then
                    MINOR_VERSION_BEST[$minor_ver]="$epoch|$dep_id"
                fi
            fi
        fi
    done

    # Build set of IDs to keep
    declare -A KEEP_IDS
    KEEP_IDS[$MOST_RECENT_ID]=1
    if [ -n "$STABLE_ID" ]; then
        KEEP_IDS[$STABLE_ID]=1
    fi
    for minor_ver in "${!MINOR_VERSION_BEST[@]}"; do
        best_id=$(echo "${MINOR_VERSION_BEST[$minor_ver]}" | cut -d'|' -f2)
        KEEP_IDS[$best_id]=1
        echo "🔹 Keeping v${minor_ver}.x: $best_id"
    done

    # Delete deployments not in keep set
    DELETED_COUNT=0
    for deployment in "${SORTED_DEPLOYMENTS[@]}"; do
        dep_id=$(echo "$deployment" | cut -d'|' -f2)
        timestamp=$(echo "$deployment" | cut -d'|' -f3)

        if [ -z "${KEEP_IDS[$dep_id]}" ]; then
            echo "🗑️  Deleting: $dep_id ($timestamp)"
            clasp undeploy "$dep_id" || echo "⚠️  Could not delete $dep_id"
            ((DELETED_COUNT++))
        fi
    done

    if [ "$DELETED_COUNT" -gt 0 ]; then
        echo "✅ Deleted $DELETED_COUNT old deployment(s)"
    else
        echo "📊 No old deployments to delete"
    fi
else
    echo "📊 Found $DEPLOYMENT_COUNT deployment(s), no cleanup needed (threshold: >${MIN_DEPLOYMENTS_BEFORE_CLEANUP})"
fi

echo "🔧 Creating new deployment..."
DEPLOYMENT_OUTPUT=$(clasp deploy --description "Chess Tracker v$VERSION - $(date '+%Y-%m-%d %H:%M:%S') git:$GIT_HASH")
echo "$DEPLOYMENT_OUTPUT"

# Extract deployment ID from output
DEPLOYMENT_ID=$(echo "$DEPLOYMENT_OUTPUT" | grep -oE 'AK[a-zA-Z0-9_-]+' | head -1)

if [ -z "$DEPLOYMENT_ID" ]; then
    echo "❌ Error: Could not extract deployment ID"
    echo "💡 Try manually checking deployments with: clasp deployments"
    exit 1
fi

echo "✅ Deployment successful!"
echo "📋 Deployment ID: $DEPLOYMENT_ID"

# Construct web app URL
WEB_APP_URL="https://script.google.com/macros/s/$DEPLOYMENT_ID/exec"
echo "🌐 Web App URL: $WEB_APP_URL"

# Open in browser
echo "🌍 Opening form in browser..."
if command -v open &> /dev/null; then
    # macOS
    open "$WEB_APP_URL"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$WEB_APP_URL"
elif command -v start &> /dev/null; then
    # Windows
    start "$WEB_APP_URL"
else
    echo "⚠️  Could not open browser automatically. Please visit: $WEB_APP_URL"
fi

echo "🎉 Deployment complete! The Chess Game Tracker form is now live."

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