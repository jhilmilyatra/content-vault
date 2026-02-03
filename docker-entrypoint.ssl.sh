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
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "   No conf.d directory (good)"

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
    echo ""
    echo "http.d contents:"
    ls -la /etc/nginx/http.d/
    echo ""
    echo "conf.d contents:"
    ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "(empty)"
    exit 1
fi
echo "   ✓ Nginx config OK"

# Start Nginx
echo ""
echo "🌐 Starting Nginx..."
nginx &
NGINX_PID=$!
sleep 2

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "❌ Nginx failed!"
    exit 1
fi
echo "   ✓ Nginx running (PID: $NGINX_PID)"

# Start Storage Server
echo ""
echo "📦 Starting Storage Server..."
cd /app/vps-storage-server && node server.js &
STORAGE_PID=$!
sleep 3

if ! kill -0 $STORAGE_PID 2>/dev/null; then
    echo "❌ Storage server failed!"
    kill $NGINX_PID 2>/dev/null
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
    kill $NGINX_PID $STORAGE_PID 2>/dev/null
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
    nginx -s quit 2>/dev/null || kill $NGINX_PID 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

# Monitor processes
while true; do
    if ! kill -0 $NGINX_PID 2>/dev/null; then
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
