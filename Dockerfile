# Stage 1: builder
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies required for NestJS build and Prisma CLI
RUN npm ci

RUN npx prisma generate

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

RUN npm run build


# Stage 2: runner
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# Prisma CLI is required because the container runs
# `prisma migrate deploy` when starting.
RUN npm ci --ignore-scripts

RUN npx prisma generate

COPY --from=builder /app/dist ./dist/

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]