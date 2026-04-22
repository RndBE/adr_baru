FROM node:20-alpine AS base

# Tahap 1: Install dependencies dan Build
FROM base AS builder
WORKDIR /app

# Copy package.json dan package-lock.json
COPY package.json package-lock.json* ./

# Install semua dependencies
RUN npm ci

# Copy seluruh file project
COPY . .

# Generate Prisma Client (karena Anda menggunakan Prisma)
RUN npx prisma generate

# Build project Next.js
RUN npm run build

# Tahap 2: Production server
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy hasil build dan module dari tahap builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Buka port 3000
EXPOSE 3000

# Jalankan aplikasi
CMD ["npm", "start"]
