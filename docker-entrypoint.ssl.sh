#!/bin/sh
set -e

echo "============================================"
echo "🚀 FileCloud - Unified SSL Deployment"
echo "============================================"
echo "📅 Started: $(date)"
echo ""

# ==========================================
# Configuration Display
# ==========================================
echo "📋 Configuration:"
echo "   ├─ Storage path: ${STORAGE_PATH:-/app/storage}"
echo "   ├─ Data path: ${DATA_PATH:-/app/data}"
echo "   ├─ CDN URL: ${VPS_CDN_URL:-not configured}"
echo "   ├─ Auto transcode: ${AUTO_TRANSCODE:-true}"
echo "   ├─ Auto thumbnails: ${AUTO_IMAGE_THUMBNAIL:-true}"
echo "   └─ SSL: Nginx termination (all traffic HTTPS)"
echo ""

# ==========================================
# SSL Certificate Setup
# ==========================================
echo "🔐 Configuring SSL certificates..."

if [ -f "/etc/nginx/ssl/custom/fullchain.pem" ] && [ -f "/etc/nginx/ssl/custom/privkey.pem" ]; then
    echo "   ✓ Using custom SSL certificates"
    cp /etc/nginx/ssl/custom/fullchain.pem /etc/nginx/ssl/fullchain.pem
    cp /etc/nginx/ssl/custom/privkey.pem /etc/nginx/ssl/privkey.pem
    chmod 600 /etc/nginx/ssl/privkey.pem
else
    echo "   ⚠ Using self-signed certificates (replace for production)"
fi

# ==========================================
# Nginx Configuration Test
# ==========================================
echo ""
echo "🔧 Testing Nginx configuration..."
if ! nginx -t 2>&1; then
    echo "❌ Nginx configuration test failed!"
    echo ""
    echo "Debug info:"
    cat /etc/nginx/conf.d/default.conf | head -50
    exit 1
fi
echo "   ✓ Nginx configuration valid"

# ==========================================
# Start Services
# ==========================================

# Start Nginx (SSL termination for all traffic)
echo ""
echo "🌐 Starting Nginx (HTTP:80 → HTTPS:443)..."
nginx &
NGINX_PID=$!
sleep 2

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "❌ Nginx failed to start!"
    cat /var/log/nginx/error.log 2>/dev/null || echo "No error log available"
    exit 1
fi
echo "   ✓ Nginx running (PID: $NGINX_PID)"

# Start VPS Storage Server (internal only)
echo ""
echo "📦 Starting Storage Server (internal:${STORAGE_PORT:-4000})..."
cd /app/vps-storage-server && node server.js &
STORAGE_PID=$!
sleep 3

if ! kill -0 $STORAGE_PID 2>/dev/null; then
    echo "❌ Storage server failed to start!"
    kill $NGINX_PID 2>/dev/null
    exit 1
fi
echo "   ✓ Storage server running (PID: $STORAGE_PID)"

# Start Frontend Server (internal only)
echo ""
echo "🎨 Starting Frontend Server (internal:${PORT:-3000})..."
cd /app && npx serve -s dist -l ${PORT:-3000} --no-clipboard &
FRONTEND_PID=$!
sleep 2

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend server failed to start!"
    kill $NGINX_PID $STORAGE_PID 2>/dev/null
    exit 1
fi
echo "   ✓ Frontend server running (PID: $FRONTEND_PID)"

# ==========================================
# Ready
# ==========================================
echo ""
echo "============================================"
echo "🎉 FileCloud is ready!"
echo "============================================"
echo ""
echo "📍 Access Points (via Nginx SSL):"
echo "   ├─ HTTP:  http://localhost:80 (→ HTTPS redirect)"
echo "   ├─ HTTPS: https://localhost:443"
echo "   └─ Health: http://localhost:3000/health (internal)"
echo ""
echo "🔗 API Endpoints (all HTTPS):"
echo "   ├─ /api/*        - Storage API"
echo "   ├─ /files/*      - File downloads"
echo "   ├─ /hls/*        - HLS streaming"
echo "   ├─ /thumbnails/* - Thumbnails"
echo "   └─ /ws           - WebSocket"
echo ""
echo "🔒 SSL Status:"
if [ -f "/etc/nginx/ssl/custom/fullchain.pem" ]; then
    echo "   └─ Using: Custom certificates"
    # Show certificate info
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/nginx/ssl/fullchain.pem 2>/dev/null | cut -d= -f2)
    echo "   └─ Expires: ${CERT_EXPIRY:-unknown}"
else
    echo "   └─ Using: Self-signed (mount custom certs to /etc/nginx/ssl/custom/)"
fi
echo ""
echo "============================================"

# ==========================================
# Signal Handling & Process Management
# ==========================================
cleanup() {
    echo ""
    echo "🛑 Shutting down gracefully..."
    kill $FRONTEND_PID 2>/dev/null
    kill $STORAGE_PID 2>/dev/null
    nginx -s quit 2>/dev/null || kill $NGINX_PID 2>/dev/null
    echo "   ✓ All services stopped"
    exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

# Monitor all processes
while true; do
    if ! kill -0 $NGINX_PID 2>/dev/null; then
        echo "⚠️ Nginx stopped unexpectedly"
        cleanup
    fi
    if ! kill -0 $STORAGE_PID 2>/dev/null; then
        echo "⚠️ Storage server stopped unexpectedly"
        cleanup
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "⚠️ Frontend server stopped unexpectedly"
        cleanup
    fi
    sleep 5
done
