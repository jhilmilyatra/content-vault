# FileCloud Migration Guide

> **Complete step-by-step guide for migrating Supabase and VPS storage configurations**

This document provides detailed instructions for replacing existing Supabase and VPS configurations with new ones. Every file, line number, and value is documented for easy reference.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Reference - All Configuration Locations](#quick-reference---all-configuration-locations)
3. [Part 1: Supabase Migration](#part-1-supabase-migration)
4. [Part 2: VPS Storage Migration](#part-2-vps-storage-migration)
5. [Part 3: VPS Server Migration](#part-3-vps-server-migration)
6. [Part 4: Environment Variables](#part-4-environment-variables)
7. [Post-Migration Verification](#post-migration-verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting the migration, ensure you have:

- [ ] New Supabase project URL and keys (if migrating Supabase)
- [ ] New VPS server IP address (if migrating VPS storage)
- [ ] New VPS API keys (if migrating VPS storage)
- [ ] SSH access to both old and new VPS servers (for data migration)
- [ ] Admin access to the codebase
- [ ] Database backup from current Supabase project

---

## Quick Reference - All Configuration Locations

### Supabase Configuration Files

| File | Line Numbers | What to Change |
|------|--------------|----------------|
| `.env` | Lines 1-4 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| `supabase/config.toml` | Line 1 | `project_id` |

### VPS Configuration (Environment Variables Only)

**All VPS configuration is now managed via environment variables in Lovable Cloud Secrets:**

| Secret Name | Description |
|-------------|-------------|
| `VPS_ENDPOINT` | Full URL to VPS storage API (e.g., `http://your-ip:4000`) |
| `VPS_API_KEY` | Standard API key for file operations |
| `VPS_OWNER_API_KEY` | Owner API key for admin operations |
| `VPS_CDN_URL` | Public HTTPS CDN URL (e.g., `https://cdn.yourdomain.com`) |
| `HLS_SIGNING_SECRET` | Secret for signing HLS/streaming URLs |

**No hardcoded IPs or credentials in code** - all edge functions read from `Deno.env.get()`.

### Docker Environment Variables

| Variable | Description |
|----------|-------------|
| `VPS_STORAGE_API_KEY` | Set in `docker-compose.yml` or `.env` file |
| `VPS_OWNER_API_KEY` | Set in `docker-compose.yml` or `.env` file |

---

## Part 1: Supabase Migration

### Step 1.1: Gather New Supabase Credentials

From your new Supabase project dashboard, collect:

1. **Project URL**: `https://[PROJECT_ID].supabase.co`
2. **Anon/Public Key**: Found in Settings → API → Project API keys → `anon public`
3. **Project ID**: The alphanumeric string in your project URL

### Step 1.2: Update Environment Variables

**File: `.env`**

```
Location: Project root
Lines to modify: 1-4
```

**Current Configuration:**
```env
VITE_SUPABASE_URL=https://dgmxndvvsbjjbnoibaid.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=dgmxndvvsbjjbnoibaid
```

**Replace With:**
```env
VITE_SUPABASE_URL=https://[YOUR_NEW_PROJECT_ID].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[YOUR_NEW_ANON_KEY]
VITE_SUPABASE_PROJECT_ID=[YOUR_NEW_PROJECT_ID]
```

**Example with real values:**
```env
VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3BxcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAxNTU3NjAwMH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_SUPABASE_PROJECT_ID=abcdefghijklmnopqrst
```

### Step 1.3: Update Supabase Config

**File: `supabase/config.toml`**

```
Location: supabase/config.toml
Line to modify: 1
```

**Current Configuration (Line 1):**
```toml
project_id = "dgmxndvvsbjjbnoibaid"
```

**Replace With:**
```toml
project_id = "[YOUR_NEW_PROJECT_ID]"
```

**Example:**
```toml
project_id = "abcdefghijklmnopqrst"
```

### Step 1.4: Database Migration

After updating credentials, you need to migrate your database schema and data:

1. **Export from old Supabase:**
   - Go to old project → Settings → Database → Backup
   - Download the backup file

2. **Import to new Supabase:**
   - Go to new project → SQL Editor
   - Run all migration files from `supabase/migrations/` folder in order

3. **Run migrations in order:**
   ```sql
   -- Check supabase/migrations/ folder for all .sql files
   -- Execute them in chronological order (by timestamp prefix)
   ```

### Step 1.5: Update Storage Buckets

In your new Supabase project:

1. Go to Storage → Create new bucket
2. Create bucket named `user-files` with public access: **No**
3. Apply RLS policies from existing migrations

---

## Part 2: VPS Storage Migration

### Step 2.1: Configure VPS Secrets in Lovable Cloud

**All VPS configuration is now done via Lovable Cloud Secrets (Settings → Secrets):**

1. **VPS_ENDPOINT**: Your VPS internal endpoint (e.g., `http://your-ip:4000`)
2. **VPS_API_KEY**: Your VPS authentication key
3. **VPS_CDN_URL**: Your Cloudflare CDN URL (e.g., `https://cdn.yourdomain.com`)
4. **VPS_OWNER_API_KEY**: Admin API key for owner operations

**No code changes required** - all edge functions read from environment variables.

### Step 2.2: Docker Environment Variables

When deploying your VPS storage server, configure these in your `docker-compose.yml` or `.env` file:

```yaml
environment:
  - VPS_STORAGE_API_KEY=your-secure-api-key
  - VPS_OWNER_API_KEY=your-owner-api-key
  - VPS_CDN_URL=https://cdn.yourdomain.com
  - HLS_SIGNING_SECRET=your-signing-secret
```

### Step 2.3: Verify Edge Functions

All edge functions now read VPS configuration from environment variables:

```typescript
// All edge functions use this pattern:
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";
```

**No code changes required** - just update the secrets in Lovable Cloud.
```

> **Note:** The sections below (Steps 2.5 through 2.10) are no longer needed.
> All edge functions now read VPS configuration from environment variables.
> Simply update the secrets in Lovable Cloud Settings → Secrets.

---

## Part 3: VPS Server Migration

### Step 3.1: Set Up New VPS Server

**Prerequisites for new VPS:**
- Node.js 18+ installed
- At least 50GB storage space
- Port 4000 open in firewall

### Step 3.2: Deploy VPS Storage Server

1. **Copy server files to new VPS:**
   ```bash
   scp -r vps-storage-server/ user@[NEW_VPS_IP]:~/vps-storage-server/
   ```

2. **SSH into new VPS:**
   ```bash
   ssh user@[NEW_VPS_IP]
   ```

3. **Install dependencies:**
   ```bash
   cd ~/vps-storage-server
   npm install
   ```

### Step 3.3: Configure VPS Server Environment

**File: `vps-storage-server/server.js`**

```
Location: vps-storage-server/server.js
Lines to modify: 28-31 (or via environment variables)
```

**Current Configuration (Lines 28-31):**
```javascript
const PORT = process.env.STORAGE_PORT || 4000;
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const API_KEY = process.env.VPS_STORAGE_API_KEY || 'change-this-api-key';
const OWNER_API_KEY = process.env.VPS_OWNER_API_KEY || 'kARTOOS007';
```

**Option A: Configure via Environment Variables (Recommended)**

Create `.env` file in `vps-storage-server/`:
```env
STORAGE_PORT=4000
STORAGE_PATH=/var/storage/filecloud
VPS_STORAGE_API_KEY=[YOUR_NEW_API_KEY]
VPS_OWNER_API_KEY=[YOUR_NEW_OWNER_API_KEY]
```

**Option B: Modify Default Values in Code**

Replace lines 28-31 with:
```javascript
const PORT = process.env.STORAGE_PORT || 4000;
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const API_KEY = process.env.VPS_STORAGE_API_KEY || '[YOUR_NEW_API_KEY]';
const OWNER_API_KEY = process.env.VPS_OWNER_API_KEY || '[YOUR_NEW_OWNER_API_KEY]';
```

### Step 3.4: Migrate Existing Files

**Option A: Using rsync (Recommended for large datasets)**

```bash
# From OLD VPS to NEW VPS
rsync -avz --progress /path/to/storage/ user@[NEW_VPS_IP]:/var/storage/filecloud/
```

**Option B: Using scp**

```bash
# From OLD VPS
scp -r /path/to/storage/* user@[NEW_VPS_IP]:/var/storage/filecloud/
```

### Step 3.5: Start VPS Server

**Using PM2 (Production - Recommended):**
```bash
npm install -g pm2
cd ~/vps-storage-server
pm2 start server.js --name "filecloud-storage"
pm2 save
pm2 startup
```

**Using systemd:**

Create `/etc/systemd/system/filecloud-storage.service`:
```ini
[Unit]
Description=FileCloud VPS Storage Server
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/home/nodeuser/vps-storage-server
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=STORAGE_PORT=4000
Environment=STORAGE_PATH=/var/storage/filecloud
Environment=VPS_STORAGE_API_KEY=[YOUR_API_KEY]
Environment=VPS_OWNER_API_KEY=[YOUR_OWNER_KEY]

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable filecloud-storage
sudo systemctl start filecloud-storage
```

---

## Part 4: Environment Variables

### Complete Environment Variable Reference

#### Frontend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abcdef.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | `eyJhbGci...` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | `abcdefghijkl` |

#### VPS Server (vps-storage-server/.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `STORAGE_PORT` | Server port | `4000` |
| `STORAGE_PATH` | Storage directory path | `/var/storage/filecloud` |
| `VPS_STORAGE_API_KEY` | API key for standard operations | `MySecureKey123` |
| `VPS_OWNER_API_KEY` | API key for owner operations | `OwnerSecureKey456` |

#### Supabase Edge Functions (Automatic)

These are automatically available in edge functions:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

---

## Post-Migration Verification

### Checklist

- [ ] **Frontend loads without errors**
  - Open browser console and check for errors
  
- [ ] **Authentication works**
  - Try logging in with existing credentials
  - Try creating a new account
  
- [ ] **File upload works**
  - Upload a test file
  - Check if it appears in the file list
  
- [ ] **File download works**
  - Download an uploaded file
  - Verify file integrity
  
- [ ] **Shared links work**
  - Create a shared link
  - Test accessing the shared link
  
- [ ] **Guest access works**
  - Create a folder share
  - Test guest registration and access
  
- [ ] **VPS health check passes**
  ```bash
  curl http://[YOUR_NEW_VPS_IP]:4000/health
  ```
  Expected response:
  ```json
  {
    "status": "online",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "storage": {...},
    "version": "2.0.0"
  }
  ```

### Testing Commands

**Test VPS Connection:**
```bash
# Health check
curl http://[YOUR_VPS_IP]:4000/health

# Stats (requires auth)
curl -H "Authorization: Bearer [YOUR_API_KEY]" http://[YOUR_VPS_IP]:4000/stats
```

**Test Edge Functions:**
```bash
# Test via Supabase URL
curl https://[YOUR_SUPABASE_PROJECT].supabase.co/functions/v1/verify-share-link \
  -H "Content-Type: application/json" \
  -d '{"shortCode": "test123"}'
```

---

## Troubleshooting

### Common Issues

#### 1. "CORS Error" in Browser Console

**Cause:** VPS server not allowing requests from your domain.

**Solution:** Check VPS server CORS configuration in `server.js` (lines 38-43):
```javascript
app.use(cors({
  origin: '*',  // Or specify your domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', ...],
}));
```

#### 2. "Failed to fetch" or Network Errors

**Cause:** VPS server not accessible or firewall blocking.

**Solution:**
1. Check if VPS server is running:
   ```bash
   curl http://[VPS_IP]:4000/health
   ```
2. Check firewall rules:
   ```bash
   sudo ufw status
   sudo ufw allow 4000
   ```

#### 3. "Invalid API key" Errors

**Cause:** API key mismatch between frontend/edge functions and VPS server.

**Solution:** Verify all locations have matching API keys:
- `src/lib/fileService.ts` line 46
- All edge functions
- VPS server configuration

#### 4. "File not found" After Migration

**Cause:** Files not migrated or storage path mismatch.

**Solution:**
1. Verify files exist on new VPS:
   ```bash
   ls -la /var/storage/filecloud/
   ```
2. Check `STORAGE_PATH` matches where files were copied

#### 5. Edge Functions Not Deploying

**Cause:** Configuration or syntax errors.

**Solution:**
1. Check Supabase dashboard for function deployment status
2. Review function logs for errors
3. Verify `supabase/config.toml` is valid

### Getting Help

If you encounter issues not covered here:

1. Check browser console for error messages
2. Check VPS server logs:
   ```bash
   pm2 logs filecloud-storage
   # or
   journalctl -u filecloud-storage -f
   ```
3. Check Supabase edge function logs in dashboard

---

## Migration Summary Checklist

### Before Migration
- [ ] Backup current database
- [ ] Document current configuration
- [ ] Prepare new credentials

### During Migration
- [ ] Update `.env` file
- [ ] Update `supabase/config.toml`
- [ ] Update `src/lib/fileService.ts`
- [ ] Update all 8 edge functions with VPS config
- [ ] Set up new VPS server
- [ ] Migrate files to new VPS
- [ ] Start VPS server

### After Migration
- [ ] Test authentication
- [ ] Test file upload/download
- [ ] Test shared links
- [ ] Test guest access
- [ ] Monitor for errors

---

## File Change Summary Table

| File | Lines | Old Value | New Value |
|------|-------|-----------|-----------|
| `.env` | 1 | `https://dgmxndvvsbjjbnoibaid.supabase.co` | `https://[NEW_PROJECT_ID].supabase.co` |
| `.env` | 2 | `eyJhbG...` | `[NEW_ANON_KEY]` |
| `.env` | 3 | `dgmxndvvsbjjbnoibaid` | `[NEW_PROJECT_ID]` |
| `supabase/config.toml` | 1 | `dgmxndvvsbjjbnoibaid` | `[NEW_PROJECT_ID]` |
| `src/lib/fileService.ts` | 45 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `src/lib/fileService.ts` | 46 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/vps-upload/index.ts` | 50 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/vps-upload/index.ts` | 51 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/vps-file/index.ts` | 19 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/vps-file/index.ts` | 20 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/vps-owner-stats/index.ts` | 10 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/vps-owner-stats/index.ts` | 11 | `kARTOOS007` | `[NEW_OWNER_KEY]` |
| `supabase/functions/shared-download/index.ts` | 10 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/shared-download/index.ts` | 11 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/verify-share-link/index.ts` | 9 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/verify-share-link/index.ts` | 10 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/guest-file-proxy/index.ts` | 11 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/guest-file-proxy/index.ts` | 12 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/guest-file-stream/index.ts` | 10 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/guest-file-stream/index.ts` | 11 | `kARTOOS007` | `[NEW_API_KEY]` |
| `supabase/functions/guest-folder-zip/index.ts` | 11 | `http://46.38.232.46:4000` | `http://[NEW_VPS_IP]:4000` |
| `supabase/functions/guest-folder-zip/index.ts` | 12 | `kARTOOS007` | `[NEW_API_KEY]` |

---

**Last Updated:** December 2024  
**Version:** 1.0.0
