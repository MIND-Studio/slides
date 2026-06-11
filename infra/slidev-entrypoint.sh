#!/bin/sh
# Slidev sidecar entrypoint. The active deck lives on the shared /data volume
# (the web container writes it via SLIDES_PATH). Slidev's entry file must sit
# inside the workspace that carries our layouts/ + styles/, so we serve a
# symlink: writes to /data/slides.md repaint the deck via HMR, exactly like
# local dev.
set -e

mkdir -p /data
[ -f /data/slides.md ] || cp /app/slidev/slides.seed.md /data/slides.md
ln -sf /data/slides.md /app/slidev/slides.md

# --remote binds 0.0.0.0 so the iframe can reach the container.
exec ./node_modules/.bin/slidev /app/slidev/slides.md --port 3101 --remote
