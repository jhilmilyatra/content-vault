#!/bin/sh

echo "🚀 Starting FileCloud VPS Server..."
echo "📅 $(date)"

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   - Storage path: ${STORAGE_PATH:-/app/storage}"
echo "   - CDN URL: ${VPS_CDN_URL:-not configured}"
echo "   - Auto transcode: ${AUTO_TRANSCODE:-true}"
echo "   - Auto image thumbnails: ${AUTO_IMAGE_THUMBNAIL:-true}"
echo "   - Thumbnail callback: ${ENABLE_THUMBNAIL_CALLBACK:-true}"
echo ""

# Start the VPS storage server in background
echo "📦 Starting Storage Server on port ${STORAGE_PORT:-4000}..."
cd /app/vps-storage-server && node server.js &
STORAGE_PID=$!

# Wait a moment for storage server to initialize
sleep 2

# Check if storage server started successfully
if ! kill -0 $STORAGE_PID 2>/dev/null; then
    echo "❌ Storage server failed to start!"
    exit 1
fi

echo "✅ Storage server running (PID: $STORAGE_PID)"

# Start the frontend server
echo "🌐 Starting Frontend Server on port ${PORT:-3000}..."
cd /app && npx serve -s dist -l ${PORT:-3000} &
FRONTEND_PID=$!

# Wait a moment for frontend to initialize
sleep 2

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend server failed to start!"
    exit 1
fi

echo "✅ Frontend server running (PID: $FRONTEND_PID)"
echo ""
echo "🎉 FileCloud is ready!"
echo "   - Frontend: http://localhost:${PORT:-3000}"
echo "   - Storage API: http://localhost:${STORAGE_PORT:-4000}"
echo ""

# Keep container running and handle signals
trap "echo 'Shutting down...'; kill $STORAGE_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for either process to exit
wait -n

# If one process exits, stop the other
echo "⚠️ A service has stopped, shutting down..."
kill $STORAGE_PID $FRONTEND_PID 2>/dev/null
exit 1
