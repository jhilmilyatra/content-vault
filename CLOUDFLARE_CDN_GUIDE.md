# Cloudflare CDN Integration Guide

This guide covers the complete setup for integrating Cloudflare CDN with your VPS video storage server for production-grade HLS streaming.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Cache Rules Configuration](#cache-rules-configuration)
4. [Origin Shield (Tiered Cache)](#origin-shield-tiered-cache)
5. [Security Settings](#security-settings)
6. [Performance Optimization](#performance-optimization)
7. [Monitoring](#monitoring)

---

## Prerequisites

- A registered domain pointing to Cloudflare nameservers
- VPS server running the storage server
- Cloudflare account (Free plan works, Pro recommended for advanced features)

---

## Initial Setup

### 1. Add Your Domain to Cloudflare

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Add a Site" and enter your domain
3. Select Free or Pro plan
4. Update your domain registrar's nameservers to Cloudflare's

### 2. Configure DNS Records

Create an **A record** pointing to your VPS:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | media | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |

**Important:** The orange cloud (Proxied) MUST be enabled for CDN caching to work.

### 3. SSL/TLS Configuration

Navigate to **SSL/TLS → Overview**:
- Set SSL mode to **Full (strict)**
- This ensures end-to-end encryption

Navigate to **SSL/TLS → Edge Certificates**:
- Enable **Always Use HTTPS**
- Enable **Automatic HTTPS Rewrites**

---

## Cache Rules Configuration

Navigate to **Caching → Cache Rules** and create the following rules:

### Rule 1: HLS Segments (.ts files)

**If:** `(http.request.uri.path contains ".ts")`

**Then:**
- Cache eligibility: **Eligible for cache**
- Edge TTL: **Override origin - 1 day (86400 seconds)**
- Browser TTL: **Override origin - 1 day (86400 seconds)**
- Cache Key: **Include query string**

**Why:** `.ts` segments are immutable once created. They never change, so aggressive caching is safe and recommended.

### Rule 2: HLS Playlists (.m3u8 files)

**If:** `(http.request.uri.path contains ".m3u8")`

**Then:**
- Cache eligibility: **Eligible for cache**
- Edge TTL: **Override origin - 30 seconds**
- Browser TTL: **Override origin - 30 seconds**
- Serve stale content while revalidating: **Enabled**

**Why:** Playlists reference the segments. For VOD content, they're stable but we keep a short TTL for flexibility.

### Rule 3: Video Thumbnails

**If:** `(http.request.uri.path contains "_thumb.jpg") or (http.request.uri.path contains "_poster.jpg")`

**Then:**
- Cache eligibility: **Eligible for cache**
- Edge TTL: **Override origin - 7 days (604800 seconds)**
- Browser TTL: **Override origin - 1 day (86400 seconds)**

**Why:** Thumbnails are static assets that rarely change.

### Rule 4: Animated Previews (.gif)

**If:** `(http.request.uri.path contains "_preview.gif")`

**Then:**
- Cache eligibility: **Eligible for cache**
- Edge TTL: **Override origin - 7 days**
- Browser TTL: **Override origin - 1 day**

---

## Origin Shield (Tiered Cache)

Origin Shield dramatically reduces load on your VPS by consolidating requests through regional data centers.

### Enable Tiered Cache

1. Navigate to **Caching → Tiered Cache**
2. Enable **Smart Tiered Cache Topology** (recommended) or select a specific region

### Smart Tiered Cache Benefits

| Without Shield | With Shield |
|---------------|-------------|
| 10,000 users = 10,000 origin hits | 10,000 users = ~10-50 origin hits |
| High VPS CPU/bandwidth | Minimal VPS load |
| Variable latency | Consistent performance |

### Regional Selection (if manual)

Choose the data center closest to your VPS:
- **Europe:** Frankfurt (FRA)
- **North America:** Ashburn (IAD) or Los Angeles (LAX)
- **Asia:** Singapore (SIN) or Tokyo (NRT)

---

## Security Settings

### Firewall Rules

Navigate to **Security → WAF** and create rules:

#### Block Suspicious HLS Access

**If:** `(http.request.uri.path contains "/hls/") and (cf.threat_score gt 10)`

**Then:** Block

#### Rate Limiting (Pro plan)

Navigate to **Security → Rate Limiting**:

- **Rule:** Limit HLS requests
- **If:** `(http.request.uri.path contains "/hls/")`
- **Rate:** 100 requests per 10 seconds per IP
- **Action:** Challenge (CAPTCHA)

### Bot Protection

Navigate to **Security → Bots**:
- Enable **Bot Fight Mode** (Free)
- Or configure **Super Bot Fight Mode** (Pro)

### Hotlink Protection

Navigate to **Scrape Shield → Hotlink Protection**:
- Enable to prevent embedding on unauthorized sites

---

## Performance Optimization

### Polish (Image Optimization)

Navigate to **Speed → Optimization → Polish**:
- Enable for thumbnail optimization
- Set to **Lossy** for best compression

### Argo Smart Routing (Paid Add-on)

If you have high traffic:
1. Navigate to **Traffic → Argo**
2. Enable Argo Smart Routing
3. Reduces latency by 30% on average

### Early Hints

Navigate to **Speed → Optimization → Early Hints**:
- Enable for faster page loads

---

## Monitoring

### Analytics

Navigate to **Analytics & Logs → Traffic**:
- Monitor cache hit ratio (aim for >90% for HLS segments)
- Track bandwidth savings

### Cache Status Headers

Your VPS already returns proper headers. Verify with:

```bash
curl -I https://media.yourdomain.com/hls/USER_ID/video/index.m3u8
```

Look for:
- `cf-cache-status: HIT` - Served from cache
- `cf-cache-status: MISS` - Fetched from origin
- `cf-cache-status: EXPIRED` - Cache expired, refetched

### Target Metrics

| Metric | Target |
|--------|--------|
| Cache Hit Ratio (.ts) | > 95% |
| Cache Hit Ratio (.m3u8) | > 80% |
| Origin Requests | < 5% of total |
| Average TTFB | < 100ms |

---

## Environment Variables

Update your VPS `.env` or docker-compose:

```yaml
environment:
  # Cloudflare integration
  - CDN_ENABLED=true
  - CDN_BASE_URL=https://media.yourdomain.com
  
  # Signed URLs (optional but recommended)
  - ENABLE_SIGNED_URLS=true
  - HLS_SIGNING_SECRET=your-secure-random-secret
```

---

## Troubleshooting

### Cache Not Working

1. Verify orange cloud is enabled in DNS
2. Check Cache-Control headers from origin
3. Review Cache Rules for conflicts
4. Clear cache: **Caching → Configuration → Purge Everything**

### Slow First Load

This is normal - first request always hits origin. Subsequent requests will be cached.

### CORS Errors

Ensure your VPS returns proper CORS headers (already configured in server.js):
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

### Video Not Playing

1. Check browser console for errors
2. Verify .m3u8 returns `application/vnd.apple.mpegurl` content-type
3. Test without CDN to isolate issue

---

## Cost Estimation (Free Plan)

| Feature | Limit |
|---------|-------|
| Bandwidth | Unlimited |
| Requests | Unlimited |
| Cache Storage | Automatic |
| Edge Locations | Global (200+ cities) |

**Note:** Cloudflare's free plan includes unlimited bandwidth for web content including video streaming. This is production-ready for most use cases.

---

## Quick Checklist

- [ ] Domain added to Cloudflare
- [ ] DNS A record created with orange cloud enabled
- [ ] SSL set to Full (strict)
- [ ] Cache rule for .ts files (24h TTL, immutable)
- [ ] Cache rule for .m3u8 files (30s TTL)
- [ ] Cache rule for thumbnails (7d TTL)
- [ ] Tiered Cache enabled
- [ ] Bot protection enabled
- [ ] Verified cache is working (cf-cache-status: HIT)

---

## References

- [Cloudflare Cache Documentation](https://developers.cloudflare.com/cache/)
- [Cloudflare Video Caching Guide](https://developers.cloudflare.com/cache/how-to/cache-video-content/)
- [HLS Streaming Best Practices](https://developer.apple.com/streaming/)
- [Cloudflare Tiered Cache](https://developers.cloudflare.com/cache/how-to/cache-shield/)
