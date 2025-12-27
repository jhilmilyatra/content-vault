# ============================================
# FileCloud VPS Deployment Dockerfile
# ============================================
# This Dockerfile creates a production-ready image
# that includes both the frontend app and a built-in
# storage server with secure file management.

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

# Install production dependencies for storage server
RUN npm install express cors multer uuid

# Create storage directory with proper structure
RUN mkdir -p /app/storage /app/data

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy VPS storage server
COPY vps-storage-server ./vps-storage-server

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PATH=/app/storage
ENV DATA_PATH=/app/data

# Required security keys (must be set at runtime)
# VPS_STORAGE_API_KEY - API key for authenticated requests
# VPS_OWNER_API_KEY - Owner API key for admin/owner operations

# Expose ports (3000 for app, 4000 for storage API)
EXPOSE 3000 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start script that runs both servers
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
