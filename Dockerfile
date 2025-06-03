# Dockerfile
# Etapa de build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm ci if package-lock.json is present and up-to-date
# Consider potential issues if only package.json is copied and package-lock.json* doesn't match anything
RUN npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY svelte.config.js ./
COPY tailwind.config.cjs postcss.config.cjs ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY static ./static

RUN npm run build

# Etapa de producción
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built app from builder stage
COPY --from=builder /app/build ./build
# Copy production node_modules from builder stage
# This ensures we only have production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
# Copy Prisma schema for runtime migrations if needed by the entrypoint script
COPY prisma/schema.prisma ./prisma/schema.prisma
# Ensure migrations are also available if your CMD runs them from the filesystem
COPY --from=builder /app/prisma/migrations ./prisma/migrations


EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node build/index.js"]
