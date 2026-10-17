#!/bin/bash
# 1Password CLI wrapper for PM2 startup
# Requires OP_SERVICE_ACCOUNT_TOKEN environment variable set on VPS

cd "$(dirname "$0")"

# Load secrets from 1Password and start PM2
op run --env-file=okno.env -- pm2 start ecosystem.config.js
