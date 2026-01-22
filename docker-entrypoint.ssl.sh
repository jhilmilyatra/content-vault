#!/bin/sh

echo "🚀 Starting FileCloud with Nginx + SSL..."
echo "📅 $(date)"

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   - Storage path: ${STORAGE_PATH:-/app/storage}"
echo "   - CDN URL: ${VPS_CDN_URL:-not configured}"
echo "   - Auto transcode: ${AUTO_TRANSCODE:-true}"
echo "   - SSL enabled: true"
echo ""

# Check if custom SSL certificates exist
if [ -f "/etc/nginx/ssl/custom/fullchain.pem" ]; then
    echo "🔐 Using custom SSL certificates"
    cp /etc/nginx/ssl/custom/fullchain.pem /etc/nginx/ssl/fullchain.pem
    cp /etc/nginx/ssl/custom/privkey.pem /etc/nginx/ssl/privkey.pem
else
    echo "🔐 Using self-signed SSL certificates (replace with real certs for production)"
fi

# Test nginx configuration
echo "🔧 Testing Nginx configuration..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

# Start Nginx
echo "🌐 Starting Nginx (HTTP:80, HTTPS:443)..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Wait for nginx to start
sleep 2

# Check if nginx started successfully
if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "❌ Nginx failed to start!"
    exit 1
fi

echo "✅ Nginx running (PID: $NGINX_PID)"

# Start the VPS storage server
echo "📦 Starting Storage Server on port ${STORAGE_PORT:-4000}..."
cd /app/vps-storage-server && node server.js &
STORAGE_PID=$!

# Wait for storage server to start
sleep 2

# Check if storage server started
if ! kill -0 $STORAGE_PID 2>/dev/null; then
    echo "❌ Storage server failed to start!"
    kill $NGINX_PID 2>/dev/null
    exit 1
fi

echo "✅ Storage server running (PID: $STORAGE_PID)"

# Start the frontend server
echo "🎨 Starting Frontend Server on port ${PORT:-3000}..."
cd /app && npx serve -s dist -l ${PORT:-3000} &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 2

# Check if frontend started
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend server failed to start!"
    kill $NGINX_PID $STORAGE_PID 2>/dev/null
    exit 1
fi

echo "✅ Frontend server running (PID: $FRONTEND_PID)"
echo ""
echo "🎉 FileCloud is ready with HTTPS!"
echo "   - HTTP:  http://localhost:80 (redirects to HTTPS)"
echo "   - HTTPS: https://localhost:443"
echo "   - Storage API: proxied at /api/ and /storage/"
echo ""
echo "⚠️  Replace self-signed certificates with real ones for production!"
echo "   Mount your certificates to /etc/nginx/ssl/custom/"
echo ""

# Handle signals for graceful shutdown
trap "echo 'Shutting down...'; kill $NGINX_PID $STORAGE_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for any process to exit
wait -n

# If one process exits, stop all others
echo "⚠️ A service has stopped, shutting down..."
kill $NGINX_PID $STORAGE_PID $FRONTEND_PID 2>/dev/null
exit 1
