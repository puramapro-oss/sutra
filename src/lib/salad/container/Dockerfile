# Build ONLY on an explicitly authorized Linux builder. No models in build context.
# This recipe is pinned; a built image digest and GPU qualification are still required.
FROM --platform=linux/amd64 node:24.21.0-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd AS node
FROM --platform=linux/amd64 python:3.12.12-slim-bookworm@sha256:2986c55feb36e6cae00fa1fefb454283e4b33f35e75ff8bdd123b134130be301

# Frozen Debian snapshot pins transitive OS packages, including ffmpeg/ffprobe.
RUN rm /etc/apt/sources.list.d/debian.sources && \
    printf '%s\n' 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20261014T000000Z bookworm main' \
    'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20261014T000000Z bookworm-security main' > /etc/apt/sources.list && \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates git ffmpeg libgomp1 libgl1 && \
    rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm

WORKDIR /app
COPY src/lib/salad/container/package.json src/lib/salad/container/package-lock.json ./
RUN node /usr/local/lib/node_modules/npm/bin/npm-cli.js ci --ignore-scripts --omit=dev --no-audit --no-fund && \
    node --import tsx --input-type=module -e "await import('pg'); await import('zod')"

COPY src/lib/salad/container/requirements.lock /opt/requirements.lock
RUN python3 -m pip install --no-cache-dir --only-binary=:all: --require-hashes -r /opt/requirements.lock && \
    python3 -m pip check
RUN git init /opt/ComfyUI && cd /opt/ComfyUI && \
    git remote add origin https://github.com/Comfy-Org/ComfyUI.git && \
    git fetch --depth=1 origin 3541246a9c997f4b8c32f9f88f3c985d02021c79 && \
    git checkout --detach 3541246a9c997f4b8c32f9f88f3c985d02021c79 && \
    rm -rf .git

# Deliberate source allowlist. No .env, repository metadata, application or account secrets.
COPY src/lib/salad/config.ts src/lib/salad/contracts.ts src/lib/salad/host.ts src/lib/salad/inspection.ts src/lib/salad/workflow-contract.ts src/lib/salad/worker.ts src/lib/salad/engine.ts src/lib/salad/http.ts src/lib/salad/serve.mts ./src/lib/salad/
COPY src/lib/salad-persistence.ts src/lib/media-probe.ts ./src/lib/
COPY scripts/comfyui-engine-server.mjs ./scripts/
COPY src/lib/salad/container/launch.mjs src/lib/salad/container/health.mjs ./src/lib/salad/container/
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin sutra && \
    mkdir -p /run/sutra /opt/ComfyUI/output /opt/ComfyUI/input /opt/ComfyUI/temp /opt/ComfyUI/user /home/sutra/.cache && \
    chown -R 10001:10001 /opt/ComfyUI/output /opt/ComfyUI/input /opt/ComfyUI/temp /opt/ComfyUI/user /home/sutra && \
    chmod -R a-w /app /opt/ComfyUI/models

ENV SALAD_ENABLED=false \
    NVIDIA_VISIBLE_DEVICES=all NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HOME=/home/sutra/.cache/huggingface TORCH_HOME=/home/sutra/.cache/torch \
    HOME=/home/sutra
USER 10001:10001
EXPOSE 7862
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=8s --start-period=300s --retries=3 CMD ["node", "--import", "tsx", "/app/src/lib/salad/container/health.mjs"]
ENTRYPOINT ["node", "--import", "tsx", "/app/src/lib/salad/container/launch.mjs"]
