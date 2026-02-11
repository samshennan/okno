#!/bin/bash
# Okno VPS Deployment Script
# This script deploys Okno to the production VPS

set -e  # Exit on error

# Load VPS configuration
source .vps-config

echo "🚀 Deploying Okno to $VPS_HOST..."

# Step 1: Install dependencies on VPS
echo "📦 Step 1: Installing dependencies..."
ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install nginx if not present
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
fi

# Install certbot for SSL
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
fi

# Install 1Password CLI if not present
if ! command -v op &> /dev/null; then
    curl https://downloads.1password.com/linux/debian/amd64/stable/1password-cli-amd64-latest.deb -o op.deb
    sudo dpkg -i op.deb
    rm op.deb
fi

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

echo "✅ Dependencies installed"
node --version
nginx -v
op --version
pm2 --version
ENDSSH

# Step 2: Set up 1Password service account token on VPS
echo "🔐 Step 2: Configuring 1Password service account..."
SERVICE_TOKEN=$(cat .op-service-token)
ssh $VPS_USER@$VPS_HOST << ENDSSH
# Add to environment
if ! grep -q "OP_SERVICE_ACCOUNT_TOKEN" ~/.bashrc; then
    echo 'export OP_SERVICE_ACCOUNT_TOKEN="$SERVICE_TOKEN"' >> ~/.bashrc
fi

# Also add to /etc/environment for PM2
if ! sudo grep -q "OP_SERVICE_ACCOUNT_TOKEN" /etc/environment; then
    echo 'OP_SERVICE_ACCOUNT_TOKEN="$SERVICE_TOKEN"' | sudo tee -a /etc/environment
fi

# Export for current session
export OP_SERVICE_ACCOUNT_TOKEN="$SERVICE_TOKEN"

# Verify
op whoami
echo "✅ 1Password CLI authenticated"
ENDSSH

# Step 3: Deploy code
echo "📂 Step 3: Deploying application code..."
ssh $VPS_USER@$VPS_HOST << ENDSSH
# Create app directory if it doesn't exist
sudo mkdir -p $VPS_APP_DIR
sudo chown $VPS_USER:$VPS_USER $VPS_APP_DIR

# Clone or update repository
if [ -d "$VPS_APP_DIR/.git" ]; then
    cd $VPS_APP_DIR
    git pull
else
    git clone https://github.com/samshennan/okno.git $VPS_APP_DIR
    cd $VPS_APP_DIR
fi

# Install dependencies
npm install --production

echo "✅ Code deployed"
ENDSSH

# Step 4: Configure nginx and SSL
echo "🌐 Step 4: Configuring nginx and SSL..."
scp nginx.conf.template $VPS_USER@$VPS_HOST:/tmp/okno-nginx.conf
ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
# Copy nginx config
sudo cp /tmp/okno-nginx.conf /etc/nginx/sites-available/okno

# Enable site
sudo ln -sf /etc/nginx/sites-available/okno /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Get SSL certificate (only if not already exists)
if [ ! -d "/etc/letsencrypt/live/okno.moonacle.com" ]; then
    sudo certbot --nginx -d okno.moonacle.com --non-interactive --agree-tos --email sam@moonacle.com
fi

echo "✅ nginx and SSL configured"
ENDSSH

# Step 5: Deploy env file and start app
echo "🚀 Step 5: Starting application with PM2..."
scp okno.env $VPS_USER@$VPS_HOST:$VPS_APP_DIR/
scp start.sh $VPS_USER@$VPS_HOST:$VPS_APP_DIR/
scp ecosystem.config.js $VPS_USER@$VPS_HOST:$VPS_APP_DIR/

ssh $VPS_USER@$VPS_HOST << ENDSSH
cd $VPS_APP_DIR

# Make start script executable
chmod +x start.sh

# Stop existing PM2 process if running
pm2 stop okno 2>/dev/null || true
pm2 delete okno 2>/dev/null || true

# Start with 1Password secrets
./start.sh

# Configure PM2 to start on boot
pm2 startup | tail -1 | sudo bash || true
pm2 save

echo "✅ Application started"
pm2 status
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app is live at: https://okno.moonacle.com"
echo ""
echo "📊 Next steps:"
echo "  - Test: curl https://okno.moonacle.com/api/health"
echo "  - View logs: ssh $VPS_USER@$VPS_HOST 'pm2 logs okno'"
echo "  - Monitor: ssh $VPS_USER@$VPS_HOST 'pm2 monit'"
