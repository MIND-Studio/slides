# syntax=docker/dockerfile:1
# Production images for mind-slides — three targets off one deps stage:
#   web    — the Next.js studio (standalone server, :3100). Renders decks
#            IN-PROCESS via the deck widget (public/deck-widget), so it is
#            self-contained and multi-user safe — no shared file, no sidecar.
#   worker — the stateless slidev export/build service (:3162). Runs real
#            `slidev export` (PDF, Chromium) + `slidev build` (static SPA) per
#            request in isolated temp dirs; holds no pod creds, persists nothing.
#            The web app reaches it via the /api/render proxy (internal only).
#   slidev — the Slidev render sidecar (:3101). OPTIONAL — kept only for opening
#            a deck in the full standalone Slidev app; the studio doesn't need it.
#
# Build (NODE_AUTH_TOKEN is required — @mind-studio/* comes from the GitHub
# Packages registry, see .npmrc):
#   docker compose -f docker-compose.prod.yml up --build
# or per-image:
#   docker build --target web    --build-arg NODE_AUTH_TOKEN -t mind-slides-web .
#   docker build --target worker --build-arg NODE_AUTH_TOKEN -t mind-slides-worker .
#   docker build --target slidev --build-arg NODE_AUTH_TOKEN -t mind-slides-slidev .

FROM node:22-alpine AS deps
WORKDIR /app
ARG NODE_AUTH_TOKEN
ENV NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN
# playwright-chromium's bundled browser is glibc and won't run on alpine (musl);
# the worker uses the system `chromium` package instead, so skip the ~150MB
# download here. (The web image doesn't need a browser at all.)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci && rm -f .npmrc

FROM deps AS build
WORKDIR /app
# NEXT_PUBLIC_* values are inlined into the client bundle AT BUILD TIME —
# override these args when the deployment doesn't run on localhost.
ARG NEXT_PUBLIC_SLIDEV_URL=http://localhost:3101
ARG NEXT_PUBLIC_POD_BASE_URL=https://pods.mindpods.org/
ARG NEXT_PUBLIC_SOLID_ISSUER
ENV NEXT_PUBLIC_SLIDEV_URL=$NEXT_PUBLIC_SLIDEV_URL \
    NEXT_PUBLIC_POD_BASE_URL=$NEXT_PUBLIC_POD_BASE_URL \
    NEXT_PUBLIC_SOLID_ISSUER=$NEXT_PUBLIC_SOLID_ISSUER \
    NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.json next.config.ts postcss.config.mjs ./
COPY public ./public
COPY src ./src
# The deck widget (in-app renderer) is built from the real slidev layouts by
# `prebuild` (npm run build:widget) into public/deck-widget before next build.
COPY widget ./widget
COPY slidev ./slidev
RUN npm run build

# ---- web: the Next standalone server ---------------------------------------
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3100 \
    SLIDES_PATH=/data/slides.md
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3100
CMD ["node", "server.js"]

# ---- slidev: the render sidecar ---------------------------------------------
FROM deps AS slidev
WORKDIR /app
COPY slidev ./slidev
# The committed gallery deck seeds the shared volume on first boot.
RUN cp slidev/slides.md slidev/slides.seed.md
COPY infra/slidev-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3101
ENTRYPOINT ["/entrypoint.sh"]

# ---- worker: stateless slidev export/build service -------------------------
# Runs the real `slidev export` (PDF, via Chromium) and `slidev build` (static
# SPA) per request in isolated temp dirs. Stateless and credential-free — never
# touches the pod; the browser uploads the artifacts it returns. Compose runs it
# on the internal network behind the web app's /api/render proxy (not public).
FROM deps AS worker
WORKDIR /app
# The Playwright browser is glibc; use Alpine's chromium and point slidev at it.
# A stable symlink keeps CHROMIUM_PATH valid across alpine chromium versions.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    && { [ -e /usr/bin/chromium-browser ] || ln -s /usr/bin/chromium /usr/bin/chromium-browser; }
ENV NODE_ENV=production \
    WORKER_PORT=3162 \
    CHROMIUM_PATH=/usr/bin/chromium-browser
COPY slidev ./slidev
COPY worker ./worker
RUN mkdir -p /app/.work
EXPOSE 3162
CMD ["node", "worker/server.mjs"]
