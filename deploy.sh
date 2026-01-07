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

echo "🔧 Creating new deployment..."
DEPLOYMENT_OUTPUT=$(clasp deploy --description "Deployment $(date '+%Y-%m-%d %H:%M:%S')")
echo "$DEPLOYMENT_OUTPUT"

# Extract deployment ID from output
DEPLOYMENT_ID=$(echo "$DEPLOYMENT_OUTPUT" | grep -oE 'AK[a-zA-Z0-9_-]+' | head -1)

if [ -z "$DEPLOYMENT_ID" ]; then
    echo "❌ Error: Could not extract deployment ID"
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