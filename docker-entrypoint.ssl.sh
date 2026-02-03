#!/bin/sh
set -e

echo "============================================"
echo "🚀 FileCloud SSL Deployment"
echo "============================================"
echo "📅 $(date)"
echo ""

echo "📋 Configuration:"
echo "   Storage: ${STORAGE_PATH:-/app/storage}"
echo "   CDN URL: ${VPS_CDN_URL:-not set}"
echo ""

# CRITICAL: Clean any stray nginx configs
echo "🧹 Cleaning nginx configs..."
rm -rf /etc/nginx/conf.d/* 2>/dev/null || true
rm -f /etc/nginx/http.d/default.conf 2>/dev/null || true

# Verify only our config exists
echo "📁 Nginx configs:"
ls -la /etc/nginx/http.d/ 2>/dev/null || echo "   No http.d directory"

# Setup SSL certificates
echo ""
echo "🔐 SSL Setup..."
if [ -f "/etc/nginx/ssl/custom/fullchain.pem" ] && [ -f "/etc/nginx/ssl/custom/privkey.pem" ]; then
    echo "   ✓ Using custom certificates"
    cp /etc/nginx/ssl/custom/fullchain.pem /etc/nginx/ssl/fullchain.pem
    cp /etc/nginx/ssl/custom/privkey.pem /etc/nginx/ssl/privkey.pem
    chmod 600 /etc/nginx/ssl/privkey.pem
else
    echo "   ⚠ Using self-signed (add certs to /etc/nginx/ssl/custom/)"
fi

# Test nginx config
echo ""
echo "🔧 Testing Nginx..."
nginx -t 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Nginx config failed!"
    exit 1
fi
echo "   ✓ Nginx config OK"

# Start Nginx (foreground first to capture errors, then daemonize)
echo ""
echo "🌐 Starting Nginx..."

# Clear any old error logs
> /var/log/nginx/error.log 2>/dev/null || true

# Start nginx
nginx 2>&1
sleep 3

# Check if nginx is running
if pgrep -x nginx > /dev/null; then
    echo "   ✓ Nginx running (PID: $(pgrep -o nginx))"
else
    echo "❌ Nginx failed to start!"
    echo ""
    echo "Error log:"
    cat /var/log/nginx/error.log 2>/dev/null || echo "   (no error log)"
    echo ""
    echo "Checking ports:"
    netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null || echo "   (netstat not available)"
    exit 1
fi

# Start Storage Server
echo ""
echo "📦 Starting Storage Server..."
cd /app/vps-storage-server && node server.js &
STORAGE_PID=$!
sleep 3

if ! kill -0 $STORAGE_PID 2>/dev/null; then
    echo "❌ Storage server failed!"
    nginx -s quit 2>/dev/null
    exit 1
fi
echo "   ✓ Storage server running (PID: $STORAGE_PID)"

# Start Frontend
echo ""
echo "🎨 Starting Frontend..."
cd /app && npx serve -s dist -l ${PORT:-3000} --no-clipboard &
FRONTEND_PID=$!
sleep 2

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend failed!"
    kill $STORAGE_PID 2>/dev/null
    nginx -s quit 2>/dev/null
    exit 1
fi
echo "   ✓ Frontend running (PID: $FRONTEND_PID)"

echo ""
echo "============================================"
echo "🎉 FileCloud Ready!"
echo "   HTTPS: https://localhost"
echo "   HTTP:  http://localhost (redirects)"
echo "============================================"
echo ""

# Graceful shutdown
cleanup() {
    echo "🛑 Shutting down..."
    kill $FRONTEND_PID $STORAGE_PID 2>/dev/null
    nginx -s quit 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

# Monitor processes
while true; do
    if ! pgrep -x nginx > /dev/null; then
        echo "⚠️ Nginx stopped"
        cleanup
    fi
    if ! kill -0 $STORAGE_PID 2>/dev/null; then
        echo "⚠️ Storage stopped"
        cleanup
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "⚠️ Frontend stopped"
        cleanup
    fi
    sleep 5
done
