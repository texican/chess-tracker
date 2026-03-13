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

echo "📤 Pushing files to Google Apps Script..."
clasp push --force

echo "🧹 Cleaning up old deployments..."
# Get full deployment list with descriptions
DEPLOYMENTS_FULL=$(clasp deployments)

# Extract deployment IDs and their timestamps from descriptions
declare -a DEPLOYMENT_DATA
while IFS= read -r line; do
    if [[ $line =~ (AK[a-zA-Z0-9_-]+).*([0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]][0-9]{2}:[0-9]{2}:[0-9]{2}) ]]; then
        dep_id="${BASH_REMATCH[1]}"
        timestamp="${BASH_REMATCH[2]}"
        # Convert to Unix epoch for comparison
        epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "$timestamp" "+%s" 2>/dev/null || echo "0")
        DEPLOYMENT_DATA+=("$epoch|$dep_id|$timestamp")
    fi
done <<< "$DEPLOYMENTS_FULL"

# Count deployments
DEPLOYMENT_COUNT=${#DEPLOYMENT_DATA[@]}

if [ "$DEPLOYMENT_COUNT" -gt 1 ]; then
    echo "📊 Found $DEPLOYMENT_COUNT deployments"

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
    else
        echo "📊 No stable version identified — only keeping most recent"
    fi

    # Delete all deployments except most recent and stable
    DELETED_COUNT=0
    for deployment in "${SORTED_DEPLOYMENTS[@]}"; do
        dep_id=$(echo "$deployment" | cut -d'|' -f2)
        timestamp=$(echo "$deployment" | cut -d'|' -f3)

        if [ "$dep_id" != "$MOST_RECENT_ID" ] && [ "$dep_id" != "$STABLE_ID" ]; then
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
    echo "📊 Found $DEPLOYMENT_COUNT deployment(s), no cleanup needed"
fi

echo "🔧 Creating new deployment..."
DEPLOYMENT_OUTPUT=$(clasp deploy --description "Deployment $(date '+%Y-%m-%d %H:%M:%S')")
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