# Flux PWA Dockerfile
# Node.js 22 Alpine

# Builder stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S flux -u 1001

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app
COPY --from=builder /etc/passwd /etc/passwd

# Set non-root user
USER flux

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-3000}/health', (r) => {if(r.statusCode !== 200) throw new Error()})"

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "--max-old-space-size=512", "server.js"]
