# syntax=docker/dockerfile:1

# Build stage: full install, then compile the app and drop dev dependencies.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are compiled into the client bundle, so this one is a
# build argument. Secrets and storage settings are read at run time instead.
ARG NEXT_PUBLIC_COACH_URL=""
ENV NEXT_PUBLIC_COACH_URL=$NEXT_PUBLIC_COACH_URL
RUN npm run build && npm prune --omit=dev

# Run stage: production dependencies and the build output only.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public

# Without BLOB_READ_WRITE_TOKEN the app stores JSON under <cwd>/.data (lib/store.ts).
# Create it owned by the non-root user so a new named volume inherits that owner.
RUN mkdir -p /app/.data && chown node:node /app/.data
VOLUME /app/.data

USER node
EXPOSE 3000

# /api/version sits behind the login gate when GYM_SECRET is set, so send it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null --header "x-gym-secret: ${GYM_SECRET}" "http://127.0.0.1:${PORT}/api/version" || exit 1

CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
