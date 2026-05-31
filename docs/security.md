# Security

This checklist is for operating not-a-cms in production.

## Secrets

- Use a unique `BETTER_AUTH_SECRET` per environment.
- Generate it with at least 64 random characters.
- Store secrets in the platform secret manager or a locked-down environment file.
- Rotate OAuth and object storage credentials when staff or vendor access changes.
- Never commit `.env`, database files, uploads, or media index directories.

## TLS And Origins

- Serve all admin and API traffic over HTTPS.
- Set `BASE_URL` to the public HTTPS API origin.
- Set `CORS_ORIGINS` to exact admin and site origins.
- Do not use wildcard CORS with credentialed requests.
- Proxy `/collab` with WebSocket upgrade headers.

## Authentication

- Magic-link auth removes passwords, but mailbox compromise still grants access. Require strong email account security for admins.
- OAuth providers should use production callback URLs only.
- Remove unused OAuth providers from production credentials.
- Review the team members screen periodically and deactivate stale accounts.

## Authorization

- Keep the first production admin account limited to trusted operators.
- Use editor/author/viewer roles for day-to-day work.
- Use collection and field access rules for private data.
- Test public reads for every collection that contains restricted fields.

## Media

- Treat uploads as untrusted input.
- Keep upload storage outside the application source tree.
- Use object storage with private write credentials and least-privilege bucket policies.
- If media is public, serve it from a dedicated media domain or bucket public URL.
- Back up both media binaries and media metadata/index files.

## Database

- Put SQLite on persistent storage with reliable disk sync.
- Back up with `sqlite3 ".backup"` for live systems.
- Restrict filesystem permissions to the app user and backup process.
- Keep database backups encrypted at rest.

## Operations

- Run the app as a non-root user.
- Restart on failure with systemd, Docker, or platform process supervision.
- Log auth, content workflow, media, and webhook events.
- Monitor `/health`.
- Apply dependency updates on a regular schedule and rerun `bun run test`, `bun run build`, and `bun run test:e2e`.

## Incident Response

If credentials or content are compromised:

1. Stop write access by disabling the affected user or rotating credentials.
2. Rotate `BETTER_AUTH_SECRET`, OAuth secrets, and object storage keys as needed.
3. Review audit events and webhook logs.
4. Restore from a known-good database and media backup if content integrity is uncertain.
5. Re-enable access only after verifying admin login, media library, and public rendering.
