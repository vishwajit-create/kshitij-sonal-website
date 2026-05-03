# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Dependencies
#   Install only production deps in a separate layer so the final image
#   doesn't carry devDependencies or the npm cache.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy manifest files first so Docker can cache this layer
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Runner (final image)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS runner

# dumb-init: tiny init system so Node receives OS signals correctly (SIGTERM etc.)
RUN apk add --no-cache dumb-init

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed deps from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY server.js        ./
COPY package.json     ./
COPY public/          ./public/

# Copy JSON data store – will be overridden by the volume mount at runtime
COPY data/            ./data/

# Declare a volume so the JSON data (articles, research, news, settings)
# persists across container restarts
VOLUME ["/app/data"]

# Switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

# Expose the port the app listens on (configurable via PORT env var)
EXPOSE 3000

# Environment defaults (override with --env-file or -e flags at runtime)
ENV NODE_ENV=production \
    PORT=3000

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
