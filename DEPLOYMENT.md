# Okno Backend Deployment Guide

This guide walks you through deploying the Okno backend to your VPS with nginx, SSL, PM2, and 1Password CLI secrets management.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] VPS with Ubuntu/Debian (SSH access)
- [ ] Domain name with DNS access
- [ ] 1Password account with CLI access
- [ ] Google OAuth credentials (from plan user_setup)
- [ ] Port 3100 available on VPS (check: `ss -tlnp | grep 3100`)

## Step 1: Prepare 1Password Secrets

### 1.1 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services → Credentials**
3. Click **Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add authorized redirect URI: `https://okno.moonacle.com/auth/callback`
   - Replace `yourdomain.com` with your actual domain
6. Click **Create** and save the Client ID and Client Secret

### 1.2 Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. User type: **External** (or Internal if using Google Workspace)
3. Fill in app name: "Okno"
4. Add your email as support contact
5. **IMPORTANT:** Set status to **"In Production"** to avoid 7-day token expiry
   - This prevents token refresh failures (blocker from STATE.md)

### 1.3 Enable Google Photos Picker API

1. Go to **APIs & Services → Library**
2. Search for "Photos Picker API"
3. Click **Enable**

### 1.4 Store Secrets in 1Password

1. Open 1Password app or web interface
2. Create a new **Login** item:
   - Name: `Okno Google OAuth`
   - Username field: [leave blank or use your Google email]
   - Add custom field `client_id`: [paste Google Client ID]
   - Add custom field `client_secret`: [paste Google Client Secret]
3. Create a new **Password** item:
   - Name: `Okno Session Secret`
   - Generate a random password (32+ characters)
   - Or use: `openssl rand -base64 32`

### 1.5 Create 1Password Service Account

1. Go to [1Password web app](https://my.1password.com)
2. Navigate to: **Settings → Developer → Service Accounts**
3. Click **Create Service Account**
4. Name: `Okno VPS`
5. Grant access to the vault containing your Okno secrets
6. Click **Create** and **save the token** (you won't see it again)
7. Store this token securely - you'll set it on the VPS

## Step 2: Configure DNS

1. Log in to your domain registrar's DNS management panel
2. Add an **A record**:
   - Host/Name: `okno` (or your chosen subdomain)
   - Type: `A`
   - Value: `[Your VPS IP address]`
   - TTL: `3600` (or default)
3. Wait for DNS propagation (5-30 minutes)
4. Verify: `nslookup okno.moonacle.com` should return 159.69.152.123

## Step 3: Set Up VPS

### 3.1 Install Dependencies

SSH into your VPS and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx (if not already installed)
sudo apt install -y nginx

# Install certbot for Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx

# Install 1Password CLI
curl https://downloads.1password.com/linux/debian/amd64/stable/1password-cli-amd64-latest.deb -o op.deb
sudo dpkg -i op.deb
rm op.deb

# Verify installations
node --version   # Should be v20.x
nginx -v        # Should show nginx version
certbot --version
op --version

# Install PM2 globally
sudo npm install -g pm2
```

### 3.2 Set Up 1Password Service Account Token

Add the 1Password service account token to your VPS environment:

```bash
# Option A: Add to ~/.bashrc (for your user only)
echo 'export OP_SERVICE_ACCOUNT_TOKEN="your-token-here"' >> ~/.bashrc
source ~/.bashrc

# Option B: Add to /etc/environment (system-wide)
echo 'OP_SERVICE_ACCOUNT_TOKEN="your-token-here"' | sudo tee -a /etc/environment
source /etc/environment

# Verify
echo $OP_SERVICE_ACCOUNT_TOKEN  # Should show your token
op whoami  # Should show your service account
```

### 3.3 Clone and Set Up Okno

```bash
# Navigate to your apps directory
cd /var/www  # Or your preferred location

# Clone the repository
git clone [your-repo-url] okno
cd okno

# Install dependencies
npm install --production

# Create okno.env file with 1Password references
cat > okno.env << 'EOF'
GOOGLE_CLIENT_ID="op://Personal/Okno Google OAuth/client_id"
GOOGLE_CLIENT_SECRET="op://Personal/Okno Google OAuth/client_secret"
SESSION_SECRET="op://Personal/Okno Session Secret/password"
EOF

# Note: Adjust the vault name "Personal" if your secrets are in a different vault
# You can check vault names with: op vault list

# Test 1Password secret injection
op run --env-file=okno.env -- printenv | grep GOOGLE_CLIENT_ID
# Should print the actual client ID (not the op:// reference)
```

## Step 4: Configure nginx

### 4.1 Create nginx Configuration

```bash
# Copy the template to nginx sites-available
sudo cp nginx.conf.template /etc/nginx/sites-available/okno

# Edit the config to replace yourdomain.com
sudo nano /etc/nginx/sites-available/okno
# Domain is already configured: okno.moonacle.com

# Enable the site
sudo ln -s /etc/nginx/sites-available/okno /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

### 4.2 Obtain SSL Certificate

```bash
# Run certbot to get Let's Encrypt certificate
sudo certbot --nginx -d okno.moonacle.com

# Follow the prompts:
# - Enter your email address
# - Agree to Terms of Service (Y)
# - Choose whether to share email with EFF (your choice)
# - Choose option 2 to redirect HTTP to HTTPS

# Verify auto-renewal is set up
sudo systemctl status certbot.timer
# Should show "active (running)"

# Test renewal (dry run - doesn't actually renew)
sudo certbot renew --dry-run
# Should complete successfully
```

## Step 5: Start the Application

### 5.1 Start with PM2

```bash
cd /var/www/okno  # Or your installation directory

# Make start script executable
chmod +x start.sh

# Start the app with 1Password secrets injected
./start.sh

# Check PM2 status
pm2 status
# Should show "okno" as "online"

# Check logs
pm2 logs okno --lines 50
# Should show "Server listening on port 3100"
```

### 5.2 Configure PM2 Auto-Start on Reboot

```bash
# Generate PM2 startup script
pm2 startup

# Copy and run the command that PM2 outputs
# It will look something like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourusername --hp /home/yourusername

# Save current PM2 process list
pm2 save

# Test reboot persistence (optional, but recommended)
# sudo reboot
# After reboot, SSH back in and run:
# pm2 status
# Should show "okno" running
```

## Step 6: Verify Deployment

### 6.1 Health Check

```bash
# From VPS
curl https://okno.moonacle.com/api/health

# Should return JSON with:
# {
#   "status": "ok",
#   "uptime": [number],
#   "auth": { "hasTokens": false, ... },
#   "cache": { "totalItems": 0 }
# }
```

### 6.2 OAuth Flow

1. Open browser and navigate to: `https://okno.yourdomain.com`
2. Click "Login with Google"
3. Should redirect to Google OAuth consent screen
4. Sign in with your Google account
5. Grant permissions (click "Allow")
6. Should redirect back to `https://okno.yourdomain.com`
7. Visit `https://okno.yourdomain.com/api/health` again
   - `auth.hasTokens` should now be `true`
   - `auth.hasRefreshToken` should be `true`

### 6.3 Photo Picker

1. Navigate to: `https://okno.yourdomain.com/api/picker`
2. Click "Start Picker Session"
3. Should open Google Photos picker in new tab
4. Select some photos
5. Return to the app - should show selection complete
6. Visit: `https://okno.yourdomain.com/api/photo/random`
7. Should display a random photo from your selection

## Step 7: Ongoing Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs okno

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# App logs (if configured)
tail -f /var/www/okno/logs/combined.log
```

### Restart Application

```bash
# Restart via PM2
pm2 restart okno

# Or restart with secrets refresh
pm2 kill
cd /var/www/okno
./start.sh
```

### Update Application

```bash
cd /var/www/okno
git pull
npm install --production
pm2 restart okno
```

### Check SSL Certificate Status

```bash
sudo certbot certificates
```

### Manual SSL Renewal (if needed)

```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Troubleshooting

### Port 3100 Already in Use

```bash
# Find what's using the port
sudo ss -tlnp | grep 3100

# Kill the process or change Okno's port in ecosystem.config.js
```

### nginx Test Fails

```bash
# Check configuration syntax
sudo nginx -t

# View detailed error
sudo nginx -t 2>&1
```

### PM2 App Crashes Immediately

```bash
# Check PM2 logs
pm2 logs okno --lines 100

# Common issues:
# - Missing environment variables
# - 1Password CLI not authenticated
# - Port already in use
# - Missing dependencies
```

### 1Password CLI "Not Authenticated"

```bash
# Verify service account token is set
echo $OP_SERVICE_ACCOUNT_TOKEN

# Test authentication
op whoami

# If not working, re-export the token
export OP_SERVICE_ACCOUNT_TOKEN="your-token-here"
```

### SSL Certificate Fails

```bash
# Verify DNS is correct
nslookup okno.yourdomain.com

# Verify nginx is serving on port 80
curl http://okno.yourdomain.com

# Check certbot logs
sudo cat /var/log/letsencrypt/letsencrypt.log
```

### OAuth Redirect URI Mismatch

Ensure the redirect URI in Google Cloud Console exactly matches:
`https://okno.yourdomain.com/auth/callback`

Common issues:
- Missing `https://`
- Wrong domain
- Trailing slash (should NOT have one)

## Security Notes

1. **Never commit** `OP_SERVICE_ACCOUNT_TOKEN` to git
2. The `okno.env` file contains `op://` references, which are safe to commit
3. Actual secrets stay in 1Password - they're injected at runtime
4. SSL certificate auto-renews every 60 days via certbot timer
5. Session cookies are secure (HTTPS-only) in production

## Next Steps

After successful deployment:

1. Phase 1, Plan 5: Human verification checkpoint - test all backend APIs
2. Phase 2: Build the slideshow frontend
3. Phase 3: Deploy to iPad Pro and set up kiosk mode

---

**Questions?** Check logs first, then refer to:
- `.planning/phases/01-backend-deployment/01-RESEARCH.md` - Technical details
- `server.js` - Main app configuration
- `ecosystem.config.js` - PM2 settings
