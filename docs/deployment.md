# Deployment

This guide covers a production deployment for a generated not-a-cms project. The runtime is Bun, with a Bun API process plus Astro-built admin and public renderer assets.

## Production Checklist

- Install Bun 1.2 or newer on the host.
- Set a stable `BASE_URL` that matches the public CMS API origin.
- Set `CORS_ORIGINS` to the exact admin and site origins that should send credentialed requests.
- Use a long random `BETTER_AUTH_SECRET`; never reuse the generated local value across environments.
- Store SQLite and local uploads on persistent disks, not ephemeral app filesystem paths.
- Terminate TLS at a reverse proxy or platform load balancer.
- Back up the database and media storage before each deploy.

## Required Environment

```bash
PORT=4321
BASE_URL=https://cms.example.com
CORS_ORIGINS=https://admin.example.com,https://www.example.com
DATABASE_URL=/var/lib/not-a-cms/data.db
BETTER_AUTH_SECRET=<64+ random characters>
MEDIA_STORAGE_PATH=/var/lib/not-a-cms/uploads
```

For object storage, replace local media with S3-compatible settings:

```bash
STORAGE_PROVIDER=r2
MEDIA_INDEX_PATH=/var/lib/not-a-cms/media-index
S3_BUCKET=my-cms-media
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
S3_PUBLIC_URL=https://media.example.com
S3_PREFIX=uploads
```

## Bun On A VPS

1. Copy the project to the server.
2. Install dependencies and build.

```bash
bun install --frozen-lockfile
bun run build
```

3. Run the built server with production env.

```bash
bun ./dist/not-a-cms.config.js
```

Use your process manager of choice, such as systemd, supervisord, or your hosting platform's process model. The process should be restarted on failure and receive the environment variables above.

## Docker Option

A minimal Dockerfile for generated projects:

```Dockerfile
FROM oven/bun:1.2
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production
EXPOSE 4321
CMD ["bun", "./dist/not-a-cms.config.js"]
```

Mount persistent volumes for `DATABASE_URL`, `MEDIA_STORAGE_PATH`, and `MEDIA_INDEX_PATH` when using SQLite or local media.

## Reverse Proxy

Terminate HTTPS at the proxy and forward requests to the Bun process:

```nginx
server {
  listen 443 ssl http2;
  server_name cms.example.com;

  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /collab {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

Keep `BASE_URL` aligned with the external HTTPS URL, not the internal proxy target.

## CORS

`CORS_ORIGINS` is a comma-separated allowlist. Use exact origins:

```bash
CORS_ORIGINS=https://admin.example.com,https://www.example.com
```

Do not use wildcard origins for production because admin requests use credentials.

## Backups

SQLite backup:

```bash
sqlite3 /var/lib/not-a-cms/data.db ".backup '/backups/not-a-cms-$(date +%F).db'"
```

Also copy the `-wal` and `-shm` files only when doing cold filesystem copies. Prefer `.backup` for live systems.

Local media backup:

```bash
rsync -a /var/lib/not-a-cms/uploads/ /backups/not-a-cms-uploads/
```

Object storage backup depends on the provider. For S3-compatible storage, mirror the bucket or prefix:

```bash
aws s3 sync s3://my-cms-media/uploads/ /backups/not-a-cms-media/
```

Back up both the SQLite database and the media index path when using object storage, because the database stores content records and the media index stores file metadata.

## Restore

1. Stop the app process.
2. Restore the SQLite database file.
3. Restore local uploads or the object storage bucket/prefix.
4. Restore the media index directory when using S3/R2.
5. Start the app and verify `/health`, admin login, media library, and one public page.
