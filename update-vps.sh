#!/bin/bash
# Quick update script for Okno VPS
# Pulls latest code and restarts PM2

set -e

# Load VPS configuration
source .vps-config

echo "🔄 Updating Okno on $VPS_HOST..."

ssh $VPS_USER@$VPS_HOST << ENDSSH
cd $VPS_APP_DIR

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Install any new dependencies
echo "📦 Installing dependencies..."
npm install --production

# Restart PM2
echo "🔄 Restarting application..."
pm2 restart okno

echo "✅ Update complete!"
pm2 status
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo "🌐 Visit: https://okno.moonacle.com"
echo ""
