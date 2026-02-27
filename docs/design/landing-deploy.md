# Landing Deployment Runbook

This document describes how to build and deploy the Deck landing image manually.

## 0. CI workflow (GitHub Actions)

Workflow file:

```text
.github/workflows/landing-image.yml
```

Capabilities:

- Build `deck/landing:latest` on GitHub Actions (`linux/amd64`).
- Run a health check against `/healthz` before completing.
- Push to GHCR when:
  - triggered by `push` to `main` with landing-related file changes, or
  - triggered manually with `push_image=true`.

Published tags:

```text
ghcr.io/<owner>/deck/landing:latest
ghcr.io/<owner>/deck/landing:sha-<commit>
```

## 1. Build the landing image

From repository root:

```bash
make build-landing-image
```

This creates the local image:

```text
deck/landing:latest
```

## 2. Transfer image to target server

Use Docker image save/load:

```bash
docker save deck/landing:latest | gzip > deck-landing-latest.tar.gz
scp deck-landing-latest.tar.gz <user>@<server>:/tmp/
ssh <user>@<server> "gunzip -c /tmp/deck-landing-latest.tar.gz | docker load"
```

## 3. Start service on server

On the server:

```bash
cd /path/to/deck
docker compose -f deploy/landing/docker-compose.yml up -d
docker compose -f deploy/landing/docker-compose.yml ps
```

The service binds to:

```text
127.0.0.1:18080
```

Health endpoint:

```text
http://127.0.0.1:18080/healthz
```

## 4. Reverse proxy example (Nginx)

```nginx
server {
    listen 80;
    server_name deck.cofy-x.space;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name deck.cofy-x.space;

    ssl_certificate /etc/letsencrypt/live/deck.cofy-x.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deck.cofy-x.space/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. Rollback procedure

If a new image is unhealthy:

1. Load the previous tar archive (`docker load`).
2. Retag it as `deck/landing:latest` if needed.
3. Restart service:

```bash
docker compose -f deploy/landing/docker-compose.yml up -d
```

4. Verify:

```bash
curl -f http://127.0.0.1:18080/healthz
```
