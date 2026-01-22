# 🔐 SSL/HTTPS Setup Guide

This guide explains how to deploy FileCloud with HTTPS using Nginx and SSL certificates.

## Quick Start

### Option 1: Self-Signed Certificates (Development)

```bash
# Build and run with self-signed certs (included by default)
docker build -f Dockerfile.ssl -t filecloud-ssl .
docker run -d -p 80:80 -p 443:443 \
  -v filecloud_storage:/app/storage \
  -e VPS_STORAGE_API_KEY=your-secure-key \
  filecloud-ssl
```

⚠️ Browsers will show a security warning with self-signed certs.

### Option 2: Let's Encrypt (Production)

```bash
# 1. Create SSL directory
mkdir -p ssl

# 2. Get certificates using certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 3. Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
sudo chmod 644 ./ssl/*.pem

# 4. Configure environment
cp .env.example .env
# Edit .env with your settings

# 5. Start with docker-compose
docker-compose -f docker-compose.ssl.yml up -d
```

### Option 3: Custom Certificates

```bash
# 1. Create SSL directory
mkdir -p ssl

# 2. Copy your certificates
cp /path/to/your/certificate.pem ./ssl/fullchain.pem
cp /path/to/your/private-key.pem ./ssl/privkey.pem

# 3. Start the container
docker-compose -f docker-compose.ssl.yml up -d
```

## File Structure

```
project/
├── Dockerfile.ssl           # Nginx + SSL Dockerfile
├── docker-compose.ssl.yml   # Production compose with SSL
├── docker-entrypoint.ssl.sh # Entrypoint script
├── nginx/
│   └── nginx.conf          # Nginx configuration
└── ssl/                    # Your SSL certificates
    ├── fullchain.pem       # Certificate chain
    └── privkey.pem         # Private key
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VPS_CDN_URL` | Your HTTPS domain URL | - |
| `VPS_STORAGE_API_KEY` | Storage API authentication key | change-this-api-key |
| `VPS_OWNER_API_KEY` | Admin API key | kARTOOS007 |
| `SUPABASE_URL` | Supabase project URL | - |
| `SUPABASE_ANON_KEY` | Supabase public key | - |

## Nginx Features

- ✅ HTTP to HTTPS redirect
- ✅ TLS 1.2 and 1.3 support
- ✅ Modern cipher suites
- ✅ HSTS headers
- ✅ Gzip compression
- ✅ Large file uploads (5GB max)
- ✅ WebSocket support
- ✅ Range requests for video streaming
- ✅ Rate limiting protection

## Certificate Renewal (Let's Encrypt)

### Automatic Renewal

```bash
# Start with certbot profile for auto-renewal
docker-compose -f docker-compose.ssl.yml --profile letsencrypt up -d
```

### Manual Renewal

```bash
# Renew certificates
sudo certbot renew

# Copy new certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/

# Restart container to pick up new certs
docker-compose -f docker-compose.ssl.yml restart
```

## Troubleshooting

### Certificate Issues

```bash
# Check certificate validity
openssl x509 -in ssl/fullchain.pem -text -noout | grep -A2 "Validity"

# Test SSL connection
openssl s_client -connect localhost:443 -servername yourdomain.com
```

### Nginx Issues

```bash
# Check nginx logs
docker logs filecloud-ssl 2>&1 | grep nginx

# Test nginx config inside container
docker exec filecloud-ssl nginx -t

# Reload nginx without restart
docker exec filecloud-ssl nginx -s reload
```

### Permission Issues

```bash
# Fix certificate permissions
chmod 644 ssl/fullchain.pem ssl/privkey.pem

# Check file ownership
ls -la ssl/
```

## Security Best Practices

1. **Always use real SSL certificates in production**
2. **Change all default API keys**
3. **Keep certificates up to date**
4. **Use strong passwords**
5. **Regular security updates**

## Ports

| Port | Protocol | Description |
|------|----------|-------------|
| 80 | HTTP | Redirects to HTTPS |
| 443 | HTTPS | Main application |

## API Endpoints (via HTTPS)

| Path | Description |
|------|-------------|
| `/` | Frontend application |
| `/api/*` | Storage API (proxied) |
| `/storage/*` | Alternative API path |
| `/files/*` | File downloads |
| `/hls/*` | HLS video streaming |
