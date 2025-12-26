#!/bin/sh

echo "🚀 Starting FileCloud VPS Server..."

# Start the VPS storage server in background
echo "📦 Starting Storage Server on port 4000..."
cd /app/vps-storage-server && node server.js &

# Start the frontend server
echo "🌐 Starting Frontend Server on port 3000..."
cd /app && npx serve -s dist -l 3000

# Keep container running
wait
