module.exports = {
  apps: [{
    name: 'okno',
    script: './server.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    combine_logs: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3100  // Avoid n8n conflict per research pitfall #8
    }
  }]
};
