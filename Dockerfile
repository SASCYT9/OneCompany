# Dockerfile для Next.js проекту OneCompany - Premium 3D Hub

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat wget
WORKDIR /app

# Копіюємо package files
COPY package.json package-lock.json* ./

# Install dependencies з legacy-peer-deps для React 19 та Three.js
RUN npm ci --legacy-peer-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Копіюємо node_modules з попереднього stage
COPY --from=deps /app/node_modules ./node_modules

# Копіюємо весь проект
COPY . .

# Вимикаємо телеметрію Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Білдимо Next.js проект
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Встановлюємо wget для healthcheck
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Створюємо непривілейованого користувача
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копіюємо public files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Копіюємо built files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Переключаємось на непривілейованого користувача
USER nextjs

EXPOSE 3000

# Запускаємо Next.js сервер
CMD ["node", "server.js"]
