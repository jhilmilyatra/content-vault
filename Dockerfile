# ============================================
# FileCloud VPS Deployment Dockerfile
# ============================================
# This Dockerfile creates a production-ready image
# that includes both the frontend app and a built-in
# storage server with secure file management.
#
# QUICK START:
#   docker build -t filecloud .
#   docker run -d -p 80:3000 -p 4000:4000 \
#     -e VPS_STORAGE_API_KEY=your-secure-key \
#     -e VPS_OWNER_API_KEY=your-owner-key \
#     -v filecloud_storage:/app/storage \
#     filecloud
#
# ============================================
# ENVIRONMENT VARIABLES
# ============================================
#
# REQUIRED:
# ---------
# VPS_STORAGE_API_KEY    API key for user file operations (upload/download)
#                        Default: change-this-api-key
#                        ⚠️ MUST be changed in production!
#
# VPS_OWNER_API_KEY      Owner API key for admin operations (stats, user management)
#                        Default: kARTOOS007
#                        ⚠️ MUST be changed in production!
#
# OPTIONAL:
# ---------
# NODE_ENV               Node.js environment (production/development)
#                        Default: production
#
# PORT                   Frontend server port
#                        Default: 3000
#
# STORAGE_PORT           VPS storage API port
#                        Default: 4000
#
# STORAGE_PATH           Path to store uploaded files
#                        Default: /app/storage
#                        💡 Mount a volume here for persistence
#
# DATA_PATH              Path for application data
#                        Default: /app/data
#
# SUPABASE_URL           Your Supabase project URL
#                        Required for database connectivity
#
# SUPABASE_ANON_KEY      Your Supabase anonymous/public key
#                        Required for client-side auth
#
# ============================================
# PORTS
# ============================================
# 3000 - Frontend application (static files + health endpoint)
# 4000 - VPS Storage API (file upload/download/management)
#
# ============================================
# VOLUMES
# ============================================
# /app/storage - User uploaded files (IMPORTANT: mount for persistence!)
# /app/data    - Application data and cache
#
# ============================================
# ENDPOINTS (Port 4000)
# ============================================
# GET  /health              - Basic health check
# GET  /health/full         - Full health with endpoint verification
# GET  /stats               - Storage statistics
# GET  /stats/user/:userId  - Per-user storage stats (owner only)
# GET  /stats/all-users     - All users overview (owner only)
# POST /upload              - Multipart file upload
# POST /upload-base64       - Base64 JSON file upload
# GET  /files/:userId/:file - File download with range support
# DELETE /files/:userId/:file - File deletion
# POST /chunk-append        - Direct chunk append for large files
# POST /chunk-upload        - Temporary chunk upload
# POST /finalize-upload     - Assemble chunks into final file
# POST /verify-file         - Verify file existence and size
# POST /cleanup-chunks      - Cleanup temporary chunk files
#
# ============================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Create storage directory with proper structure
RUN mkdir -p /app/storage /app/data

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy VPS storage server
COPY vps-storage-server ./vps-storage-server

# Install VPS server dependencies
WORKDIR /app/vps-storage-server
RUN npm install --production
WORKDIR /app

# ============================================
# Default Environment Variables
# ============================================
# These can be overridden at runtime with -e flag
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PORT=4000
ENV STORAGE_PATH=/app/storage
ENV DATA_PATH=/app/data

# Security keys - CHANGE THESE IN PRODUCTION!
ENV VPS_STORAGE_API_KEY=change-this-api-key
ENV VPS_OWNER_API_KEY=kARTOOS007

# Expose ports
# 3000: Frontend application
# 4000: VPS Storage API
EXPOSE 3000 4000

# Health check - verifies both services are running
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Copy and prepare entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Start both frontend and storage servers
CMD ["/docker-entrypoint.sh"]
