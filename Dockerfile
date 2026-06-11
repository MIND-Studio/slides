# syntax=docker/dockerfile:1
# Production images for mind-slides — two targets off one deps stage:
#   web    — the Next.js studio (standalone server, :3100)
#   slidev — the Slidev render sidecar (:3101)
#
# The two share the ACTIVE deck through one file: the web container writes
# $SLIDES_PATH (/data/slides.md on a shared volume), the sidecar serves a
# symlink to it, and Slidev HMR repaints on every write — same mechanism as
# local dev, containerized.
#
# Build (NODE_AUTH_TOKEN is required — @mind-studio/* comes from the GitHub
# Packages registry, see .npmrc):
#   docker compose -f docker-compose.prod.yml up --build
# or per-image:
#   docker build --target web    --build-arg NODE_AUTH_TOKEN -t mind-slides-web .
#   docker build --target slidev --build-arg NODE_AUTH_TOKEN -t mind-slides-slidev .

FROM node:22-alpine AS deps
WORKDIR /app
ARG NODE_AUTH_TOKEN
ENV NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN
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
