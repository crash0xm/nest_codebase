# -------------------------------------------------
# Stage 1: deps - install production dependencies
# -------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@latest \
  && pnpm install --frozen-lockfile --prod

# -------------------------------------------------
# Stage 2: builder - build TypeScript
# -------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@latest \
  && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# -------------------------------------------------
# Stage 3: runner - production runtime
# -------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: run as non-root user
RUN addgroup --system appgroup \
  && adduser --system --ingroup appgroup appuser

# Copy artifacts from previous stages
COPY --from=deps    /app/node_modules      ./node_modules
COPY --from=builder /app/dist              ./dist
COPY package.json ./

USER appuser

EXPOSE 3000

# WARNING: DO NOT run migrations here - see scripts/migrate.sh
CMD ["node", "dist/main"]
