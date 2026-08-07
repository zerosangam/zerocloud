# Changelog

## [2.1.0] — Production-readiness pass

Read `SECURITY_NOTICE.md` first, then `BUG_REPORT.md` for the full
per-issue write-up. This changelog is the short version.

### Security
- Replaced client-trusted `x-user-id` header auth with signed session
  tokens (`services/tokenService.js`, `middleware/auth.js`).
- Passwords are now hashed (`scrypt`) instead of stored in plain text
  (`services/passwordService.js`).
- Added rate limiting on `/api/auth/*` (`middleware/rateLimit.js`).
- Fixed stored-XSS in the file grid by rendering with DOM APIs instead of
  `innerHTML` string interpolation (`public/script.js`).
- File/user IDs switched from timestamp-based to `crypto.randomUUID()`.
- Added baseline security headers and disabled `X-Powered-By`
  (`middleware/security.js`).
- Removed real secrets from the delivered project; added `.env.example`
  with placeholders.

### Fixed
- Upload was completely broken: code read `TELEGRAM_CHAT_ID` from the
  environment, but `.env` defines `CHANNEL_ID`. Standardized on
  `CHANNEL_ID` and validated required env vars at boot
  (`config/env.js`).
- Upload limit lowered from 50MB to 20MB to match Telegram's actual
  `getFile` download limit — previously, larger uploads "succeeded" and
  then could never be previewed or downloaded.
- JSON "database" writes are now atomic and serialized per file
  (`database/db.js`), preventing silent data loss on concurrent writes.
- Added a JSON 404 handler for unmatched `/api/*` routes and a
  centralized error handler (`middleware/errorHandler.js`) so no request
  path can return an unhandled crash or raw stack trace.
- Added input validation on register/login (username format/length,
  minimum password length).
- Added graceful shutdown (`SIGINT`/`SIGTERM`) and `unhandledRejection`
  logging.

### Changed (architecture)
- Split the single `fileController.js` into `services/` (Telegram API,
  tokens, passwords), `database/db.js` (storage), and separate
  `authController.js` / `fileController.js` (HTTP layer only). See
  `OPTIMIZATION_REPORT.md`.
- Split routes into `routes/authRoutes.js` and `routes/fileRoutes.js`.
- `database/users.json` and `database/files.json` are now the real,
  separately-used stores; removed the stray, secret-containing root-level
  `db.json` and the previously-unused empty `database/users.json`.

### Frontend / UX
- Added responsive breakpoints for tablet and phone widths (previously
  none existed at all).
- Added accessibility improvements: labeled inputs, `aria-label`s,
  keyboard support for the upload drop zone and file preview thumbnails,
  focus management and `Escape`-to-close on the preview modal, visible
  focus rings, `prefers-reduced-motion` support.
- Inline auth error messages (previously errors only showed as toasts,
  which are easy to miss on a form submit).
- Client-side 20MB file size check with a clear message before attempting
  an upload that would be rejected anyway.
- Session-expiry now logs the user out with an explanation instead of
  requests silently failing.

### Dependencies
- Bumped `axios`, `express`, `form-data`, `nodemon` to current stable
  minor/patch versions (no breaking major-version changes).

### Not changed (by design — see `OPTIMIZATION_REPORT.md`)
- `/api/preview/:id` and `/api/download/:id` remain reachable by anyone
  with the (now-unguessable) file ID/link, since they're loaded via HTML
  tags that can't attach an auth header. This mirrors the original app's
  design and a typical "shareable link" model.
- No bundler/build step was introduced; the frontend is still plain
  HTML/CSS/JS, which is appropriate at its current size.
