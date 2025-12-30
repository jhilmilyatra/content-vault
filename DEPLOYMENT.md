# FileCloud Production Deployment Guide

> **Complete step-by-step guide for deploying FileCloud to production**

This document provides detailed instructions for deploying the FileCloud application, including frontend deployment via Lovable, VPS storage server setup, and production configuration.

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Frontend Deployment (Lovable)](#part-1-frontend-deployment-lovable)
4. [Part 2: VPS Storage Server Deployment](#part-2-vps-storage-server-deployment)
5. [Part 3: Database & Backend (Lovable Cloud)](#part-3-database--backend-lovable-cloud)
6. [Part 4: Domain & SSL Configuration](#part-4-domain--ssl-configuration)
7. [Part 5: Production Security Hardening](#part-5-production-security-hardening)
8. [Part 6: Monitoring & Logging](#part-6-monitoring--logging)
9. [Part 7: Backup & Recovery](#part-7-backup--recovery)
10. [Part 8: Scaling Guide](#part-8-scaling-guide)
11. [Deployment Checklist](#deployment-checklist)

---

## Deployment Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     ┌──────────────────┐     ┌───────────────┐ │
│  │   Users     │────▶│  Lovable CDN     │────▶│  Frontend     │ │
│  │  (Browser)  │     │  (*.lovable.app) │     │  (React App)  │ │
│  └─────────────┘     └──────────────────┘     └───────┬───────┘ │
│                                                        │         │
│                      ┌────────────────────────────────┘         │
│                      ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Lovable Cloud                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │   │
│  │  │  Database  │  │  Auth      │  │  Edge Functions    │  │   │
│  │  │ (Postgres) │  │  (Supabase)│  │  (Deno Runtime)    │  │   │
│  │  └────────────┘  └────────────┘  └─────────┬──────────┘  │   │
│  └────────────────────────────────────────────┼─────────────┘   │
│                                                │                 │
│                      ┌─────────────────────────┘                 │
│                      ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   VPS Storage Server                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │   │
│  │  │  Node.js   │  │  Express   │  │  File Storage      │  │   │
│  │  │  Server    │  │  API       │  │  (Disk/SSD)        │  │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component | Technology | Deployment Method |
|-----------|------------|-------------------|
| Frontend | React + Vite | Lovable Platform |
| Database | PostgreSQL | Lovable Cloud |
| Authentication | Supabase Auth | Lovable Cloud |
| Edge Functions | Deno | Lovable Cloud (Auto) |
| File Storage | Node.js/Express | VPS Server |

---

## Prerequisites

### Required Accounts & Access

- [ ] Lovable account with active subscription
- [ ] VPS provider account (DigitalOcean, Linode, Hetzner, etc.)
- [ ] Domain registrar access (optional, for custom domain)
- [ ] SSH key pair for VPS access

### VPS Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Bandwidth | 1 TB/month | Unmetered |

### Software Requirements (VPS)

- Node.js 18+ LTS
- npm 9+ or yarn 1.22+
- PM2 (process manager)
- Nginx (reverse proxy)
- Certbot (SSL certificates)

---

## Part 1: Frontend Deployment (Lovable)

### Step 1.1: Prepare for Production

1. **Review Environment Variables**
   - Ensure `.env` has correct production values
   - Verify Lovable Cloud connection is active

2. **Test Build Locally**
   ```bash
   npm run build
   ```

### Step 1.2: Deploy via Lovable

1. **Click the Publish Button**
   - Located in top-right corner of Lovable editor
   
2. **Configure Deployment Settings**
   - Choose deployment environment
   - Review changes to be deployed

3. **Click "Update" to Deploy**
   - Frontend will be deployed to `yourproject.lovable.app`

### Step 1.3: Verify Deployment

1. **Access your deployed app:**
   ```
   https://[your-project-name].lovable.app
   ```

2. **Check browser console for errors**

3. **Test core functionality:**
   - Authentication (login/signup)
   - File upload/download
   - Shared links

### Understanding Deployment Types

| Change Type | Deployment | Action Required |
|-------------|------------|-----------------|
| Frontend (UI, styling) | Manual | Click "Update" in publish dialog |
| Edge Functions | Automatic | Deploys immediately on save |
| Database Migrations | Automatic | Deploys when migration is approved |

---

## Part 2: VPS Storage Server Deployment

### Step 2.1: Initial VPS Setup

**Connect to VPS:**
```bash
ssh root@YOUR_VPS_IP
```

**Create non-root user:**
```bash
adduser filecloud
usermod -aG sudo filecloud
su - filecloud
```

**Update system packages:**
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2.2: Install Node.js

**Install Node.js 20 LTS:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Verify installation:**
```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 2.3: Install PM2

```bash
sudo npm install -g pm2
```

### Step 2.4: Deploy Application Code

**Create application directory:**
```bash
sudo mkdir -p /var/www/filecloud-storage
sudo chown filecloud:filecloud /var/www/filecloud-storage
```

**Clone or copy application:**
```bash
cd /var/www/filecloud-storage

# Option A: Clone from Git
git clone https://github.com/YOUR_REPO/filecloud-storage.git .

# Option B: Copy from local
# Use SCP from your local machine:
# scp -r vps-storage-server/* filecloud@YOUR_VPS_IP:/var/www/filecloud-storage/
```

**Install dependencies:**
```bash
npm install --production
```

### Step 2.5: Configure Environment Variables

**Create environment file:**
```bash
sudo nano /var/www/filecloud-storage/.env
```

**Add configuration:**
```env
# Server Configuration
NODE_ENV=production
STORAGE_PORT=4000
STORAGE_PATH=/var/storage/filecloud

# API Keys (CHANGE THESE!)
VPS_STORAGE_API_KEY=your-secure-api-key-here
VPS_OWNER_API_KEY=your-secure-owner-key-here

# Optional: Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Generate secure API keys:**
```bash
# Generate random keys
openssl rand -hex 32  # Use for VPS_STORAGE_API_KEY
openssl rand -hex 32  # Use for VPS_OWNER_API_KEY
```

### Step 2.6: Create Storage Directory

```bash
sudo mkdir -p /var/storage/filecloud
sudo chown -R filecloud:filecloud /var/storage/filecloud
sudo chmod 750 /var/storage/filecloud
```

### Step 2.7: Configure PM2

**Create PM2 ecosystem file:**
```bash
nano /var/www/filecloud-storage/ecosystem.config.js
```

**Add configuration:**
```javascript
module.exports = {
  apps: [{
    name: 'filecloud-storage',
    script: 'server.js',
    cwd: '/var/www/filecloud-storage',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      STORAGE_PORT: 4000,
      STORAGE_PATH: '/var/storage/filecloud'
    },
    env_file: '/var/www/filecloud-storage/.env',
    error_file: '/var/log/pm2/filecloud-storage-error.log',
    out_file: '/var/log/pm2/filecloud-storage-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

**Create log directory:**
```bash
sudo mkdir -p /var/log/pm2
sudo chown filecloud:filecloud /var/log/pm2
```

**Start application:**
```bash
cd /var/www/filecloud-storage
pm2 start ecosystem.config.js
```

**Save PM2 configuration:**
```bash
pm2 save
```

**Setup PM2 startup script:**
```bash
pm2 startup systemd -u filecloud --hp /home/filecloud
# Run the command it outputs
```

### Step 2.8: Configure Firewall

```bash
# Install UFW if not present
sudo apt install ufw -y

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow storage server port (internal only if using Nginx)
# sudo ufw allow 4000/tcp  # Only if not using Nginx proxy

# Enable firewall
sudo ufw enable
```

### Step 2.9: Install and Configure Nginx

**Install Nginx:**
```bash
sudo apt install nginx -y
```

**Create Nginx configuration:**
```bash
sudo nano /etc/nginx/sites-available/filecloud-storage
```

**Add configuration:**
```nginx
upstream filecloud_storage {
    server 127.0.0.1:4000;
    keepalive 64;
}

server {
    listen 80;
    server_name storage.yourdomain.com;  # Replace with your domain

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name storage.yourdomain.com;  # Replace with your domain

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/storage.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/storage.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Max upload size (adjust as needed)
    client_max_body_size 500M;

    # Proxy settings
    location / {
        proxy_pass http://filecloud_storage;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://filecloud_storage/health;
        proxy_http_version 1.1;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|txt)$ {
        proxy_pass http://filecloud_storage;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/filecloud-storage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2.10: Install SSL Certificate

**Install Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

**Obtain certificate:**
```bash
sudo certbot --nginx -d storage.yourdomain.com
```

**Verify auto-renewal:**
```bash
sudo certbot renew --dry-run
```

### Step 2.11: Verify Deployment

**Check service status:**
```bash
pm2 status
pm2 logs filecloud-storage --lines 50
```

**Test endpoints:**
```bash
# Health check
curl https://storage.yourdomain.com/health

# Stats (with auth)
curl -H "Authorization: Bearer YOUR_API_KEY" https://storage.yourdomain.com/stats
```

---

## Part 3: Database & Backend (Lovable Cloud)

### Step 3.1: Database Configuration

Database is automatically managed by Lovable Cloud. To access:

1. Open Lovable editor
2. Click on "Cloud" tab
3. Navigate to "Database"

### Step 3.2: Edge Functions

Edge functions deploy automatically when you save changes in Lovable.

**Current Edge Functions:**

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `vps-upload` | Handle small file uploads (<5MB) | Yes |
| `vps-chunked-upload` | Handle large file uploads with resumable chunks | Yes |
| `vps-file` | File operations (get, delete) | Yes |
| `vps-owner-stats` | Owner storage statistics | Yes (Owner) |
| `shared-download` | Public file download | No |
| `verify-share-link` | Verify shared links | No |
| `guest-file-proxy` | Guest file download | No (validated) |
| `guest-file-stream` | Guest file streaming | No (validated) |
| `guest-folder-zip` | Guest folder download as ZIP | No (validated) |
| `guest-folder-contents` | Guest folder browsing | No (validated) |
| `guest-folders` | Guest folder listing | No (validated) |
| `guest-register` | Guest registration | No |
| `guest-signin` | Guest authentication | No |
| `guest-messages` | Guest messaging | No (validated) |
| `create-user` | Admin user creation | Yes (Owner) |
| `admin-suspend-user` | Admin user suspension | Yes (Admin) |
| `owner-update-user` | Owner user updates | Yes (Owner) |
| `reset-guest-password` | Guest password reset | Yes (Member+) |
| `reset-user-password` | User password reset | Yes (Admin) |
| `telegram-upload` | Telegram bot file upload | Token Auth |
| `track-file-view` | Track file views/downloads | Yes |
| `system-monitor` | System health monitoring | Yes (Owner) |
| `background-jobs` | Background task processing | Internal |

### Step 3.3: Secrets Management

Secrets are managed through Lovable Cloud:

1. Open Lovable editor
2. Click on "Cloud" tab
3. Navigate to "Secrets"

**Required secrets for edge functions:**
- `SUPABASE_URL` (auto-configured)
- `SUPABASE_ANON_KEY` (auto-configured)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-configured)

---

## Part 4: Domain & SSL Configuration

### Step 4.1: Custom Domain for Frontend

1. **In Lovable:**
   - Go to Project Settings → Domains
   - Add your custom domain

2. **In DNS Provider:**
   - Add CNAME record pointing to your Lovable app
   ```
   Type: CNAME
   Name: @ or www
   Value: [your-project].lovable.app
   ```

3. **Wait for propagation** (up to 48 hours)

### Step 4.2: Update VPS Configuration

After setting up custom domain, update edge functions to use HTTPS VPS endpoint:

**Files to update with HTTPS endpoint:**
- `src/lib/fileService.ts` (line 45)
- All edge functions with VPS configuration

**Example:**
```typescript
// Before
const VPS_ENDPOINT = "http://46.38.232.46:4000";

// After
const VPS_ENDPOINT = "https://storage.yourdomain.com";
```

---

## Part 5: Production Security Hardening

### Step 5.1: VPS Security

**Disable root login:**
```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

**Configure fail2ban:**
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**Set up automatic security updates:**
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Step 5.2: API Key Rotation

Regularly rotate API keys:

1. Generate new keys
2. Update VPS server `.env`
3. Update all edge functions
4. Deploy changes
5. Test functionality
6. Revoke old keys

### Step 5.3: Rate Limiting

Add rate limiting to VPS server:

```javascript
// In server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/upload', limiter);
app.use('/upload-base64', limiter);
```

### Step 5.4: Content Security

**Add security middleware to VPS server:**

```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

## Part 6: Monitoring & Logging

### Step 6.1: PM2 Monitoring

**View logs:**
```bash
pm2 logs filecloud-storage
pm2 logs filecloud-storage --lines 100
```

**Monitor resources:**
```bash
pm2 monit
```

### Step 6.2: Nginx Access Logs

**View access logs:**
```bash
sudo tail -f /var/log/nginx/access.log
```

**View error logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

### Step 6.3: Setup Log Rotation

**Create logrotate configuration:**
```bash
sudo nano /etc/logrotate.d/filecloud
```

**Add configuration:**
```
/var/log/pm2/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 filecloud filecloud
}
```

### Step 6.4: Health Monitoring

**Create monitoring script:**
```bash
nano /home/filecloud/health-check.sh
```

```bash
#!/bin/bash
HEALTH_URL="http://localhost:4000/health"
SLACK_WEBHOOK="your-slack-webhook-url"  # Optional

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
    echo "$(date): Health check failed with status $response"
    # Restart service
    pm2 restart filecloud-storage
    
    # Optional: Send Slack notification
    # curl -X POST -H 'Content-type: application/json' \
    #   --data '{"text":"FileCloud storage server restarted due to health check failure"}' \
    #   $SLACK_WEBHOOK
fi
```

**Make executable and add to cron:**
```bash
chmod +x /home/filecloud/health-check.sh
crontab -e
# Add: */5 * * * * /home/filecloud/health-check.sh >> /var/log/pm2/health-check.log 2>&1
```

---

## Part 7: Backup & Recovery

### Step 7.1: File Storage Backup

**Create backup script:**
```bash
nano /home/filecloud/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/filecloud"
STORAGE_DIR="/var/storage/filecloud"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz -C $STORAGE_DIR .

# Remove old backups
find $BACKUP_DIR -name "storage_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: storage_$DATE.tar.gz"
```

**Schedule backup:**
```bash
chmod +x /home/filecloud/backup.sh
crontab -e
# Add: 0 2 * * * /home/filecloud/backup.sh >> /var/log/backup.log 2>&1
```

### Step 7.2: Remote Backup

**Sync to remote storage:**
```bash
# Using rclone (example with S3-compatible storage)
rclone sync /var/backups/filecloud remote:filecloud-backups
```

### Step 7.3: Database Backup

Database backups are handled by Lovable Cloud. To export:

1. Go to Cloud → Database → Tables
2. Select table
3. Click Export

### Step 7.4: Recovery Procedure

**Restore file storage:**
```bash
# Stop service
pm2 stop filecloud-storage

# Restore from backup
tar -xzf /var/backups/filecloud/storage_YYYYMMDD_HHMMSS.tar.gz -C /var/storage/filecloud

# Start service
pm2 start filecloud-storage
```

---

## Part 8: Scaling Guide

### Step 8.1: Vertical Scaling

**Upgrade VPS resources:**
1. Increase CPU/RAM through provider dashboard
2. Reboot server
3. Verify services restart correctly

### Step 8.2: Horizontal Scaling (Multiple VPS)

For high-traffic deployments:

1. **Deploy multiple VPS storage servers**
2. **Use load balancer (e.g., DigitalOcean Load Balancer, Nginx)**
3. **Implement shared storage (NFS, GlusterFS, or object storage)**

**Example Nginx load balancer:**
```nginx
upstream storage_servers {
    least_conn;
    server storage1.yourdomain.com:4000;
    server storage2.yourdomain.com:4000;
    server storage3.yourdomain.com:4000;
}
```

### Step 8.3: CDN Integration

For improved file delivery:

1. **Add CloudFlare or similar CDN**
2. **Configure caching rules for static files**
3. **Update DNS to point through CDN**

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] API keys generated and secured
- [ ] VPS server provisioned
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificates ready

### Frontend Deployment

- [ ] Build tested locally
- [ ] Lovable Cloud connected
- [ ] Published via Lovable
- [ ] Custom domain configured (optional)
- [ ] Verified in browser

### VPS Deployment

- [ ] Node.js installed
- [ ] PM2 installed and configured
- [ ] Application code deployed
- [ ] Environment variables set
- [ ] Storage directory created
- [ ] Firewall configured
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] Service started and verified

### Post-Deployment

- [ ] All endpoints tested
- [ ] Authentication working
- [ ] File upload/download working
- [ ] Shared links working
- [ ] Guest access working
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Security hardening applied

### Ongoing Maintenance

- [ ] Weekly: Check logs for errors
- [ ] Weekly: Verify backups are running
- [ ] Monthly: Apply security updates
- [ ] Quarterly: Rotate API keys
- [ ] Quarterly: Review access logs

---

## Quick Commands Reference

```bash
# PM2 Commands
pm2 start ecosystem.config.js    # Start application
pm2 stop filecloud-storage       # Stop application
pm2 restart filecloud-storage    # Restart application
pm2 logs filecloud-storage       # View logs
pm2 monit                        # Monitor resources
pm2 save                         # Save current process list
pm2 startup                      # Configure startup script

# Nginx Commands
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Reload configuration
sudo systemctl restart nginx     # Restart Nginx
sudo systemctl status nginx      # Check status

# SSL Certificate
sudo certbot renew               # Renew certificates
sudo certbot renew --dry-run     # Test renewal

# System Commands
sudo systemctl status ufw        # Check firewall status
sudo ufw status                  # List firewall rules
df -h                            # Check disk space
free -h                          # Check memory usage
htop                             # Process monitor
```

---

**Last Updated:** December 2024  
**Version:** 1.0.0
