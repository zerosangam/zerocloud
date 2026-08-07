# Optimization & Architecture Report

## Architecture

**Before:** `controllers/fileController.js` mixed four responsibilities —
HTTP request/response handling, Telegram API calls, JSON "database" access,
and business logic (categorization, auth) — in one 190-line file. Auth and
file logic were also both crammed into the same controller and route file.

**After:** each concern is its own module:
- `config/env.js` — reads and validates environment variables once, at boot.
- `services/telegramService.js` — all Telegram Bot API calls.
- `services/tokenService.js` — session token signing/verification.
- `services/passwordService.js` — password hashing/verification.
- `database/db.js` — atomic, queued JSON file I/O.
- `controllers/authController.js` / `controllers/fileController.js` — HTTP
  layer only, delegating to the above.
- `middleware/` — auth, rate limiting, security headers, error handling.

This makes each piece independently testable (e.g. `tokenService` and
`passwordService` have no Express or filesystem dependency at all) and
means a future change — like swapping the JSON file for a real database —
only touches `database/db.js`, not every controller.

## Security (see `BUG_REPORT.md` for the full list with explanations)

- Signed session tokens replace a trusted client header (critical — was a
  full account-impersonation hole).
- Password hashing (`scrypt`) replaces plain-text storage.
- Rate limiting on auth endpoints.
- Stored-XSS fix in file card rendering (DOM APIs instead of `innerHTML`
  + string interpolation).
- Unguessable (`crypto.randomUUID()`) file/user IDs instead of
  timestamp-based ones.
- Baseline security headers + `X-Powered-By` disabled.
- Request body size limits (`express.json({ limit: '1mb' })`) to reduce
  trivial memory-exhaustion vectors on the JSON API.

**Known, accepted limitation:** `/api/preview/:id` and `/api/download/:id`
are not gated behind the auth token, because they're loaded via
`<img src>`, `<video>`, `<a download>` — none of which can attach an
`Authorization` header. This is the same trust model as a typical
"anyone with the link" share URL, and matches the original app's design.
The IDs are now unguessable UUIDs rather than the original, more
guessable, timestamp-based ones, which meaningfully narrows this
exposure. If you need real per-user access control on preview/download,
the standard fix is short-lived signed URL tokens (e.g.
`/api/preview/:id?exp=...&sig=...`) — flagged here as a possible follow-up
rather than implemented, since it changes the URL contract every existing
client (including the one in this project) relies on.

## Reliability

- **Atomic, queued writes** (`database/db.js`): write-to-temp-file +
  `rename()`, serialized per file, so concurrent requests can no longer
  race and silently drop each other's write, and a crash mid-write can't
  corrupt the JSON store.
- **Fail-fast boot checks** (`config/env.js`): missing `BOT_TOKEN` /
  `CHANNEL_ID` now stop the server immediately with a clear message,
  instead of the app booting fine and failing deep inside the first
  upload request.
- **Centralized error handling** (`middleware/errorHandler.js`): no route
  can leak an unhandled stack trace or crash the process on an unexpected
  error; Multer-specific errors get friendly messages.
- **Graceful shutdown**: `SIGINT`/`SIGTERM` now close the HTTP server
  cleanly; `unhandledRejection` is logged instead of failing silently.

## Performance

- `services/telegramService.js` sets `maxBodyLength`/`maxContentLength` to
  `Infinity` on the upload call specifically (axios defaults to a low
  limit that can truncate larger multipart bodies) while the JSON API
  routes keep a tight 1MB body limit — right-sized limits per route
  instead of one blanket setting.
- `Cache-Control: private, max-age=3600` added to `/api/preview/:id`
  responses so a browser doesn't re-fetch an already-open image/video
  from Telegram on every re-render.
- `getFiles` no longer mutates the shared files array in place with
  `.reverse()` (it copies first) — a pre-existing but easy-to-miss bug
  where repeated calls without a page reload would gradually reorder the
  in-memory copy inconsistently with the on-disk one.
- There's no database query layer to optimize (it's a flat JSON file), so
  the meaningful performance lever here is architectural: if this project
  grows past a few thousand files, `database/db.js`'s "read whole file /
  write whole file" pattern is the first thing to replace — see "Future
  scalability" below.

## Frontend / UX

- **Responsive design added.** The original stylesheet had zero `@media`
  queries; a fixed 350px search box and multi-column grids broke down
  under ~640px width. Added phone and tablet breakpoints in
  `public/style.css` covering the nav, stats grid, file grid, category
  pills, and preview modal.
- **Accessibility:** labeled form inputs, `aria-label`s on icon-only
  buttons, keyboard support for the drop zone and file preview thumbnails
  (previously mouse-only), a live region on the toast container, focus
  return to the modal's close button when it opens, `Escape` to close the
  modal, and visible focus rings for keyboard navigation
  (`:focus-visible`). Respects `prefers-reduced-motion`.
- **Basic SEO/meta:** added a `<meta name="description">` and
  `theme-color`; `font-display: swap` was already implied by the Google
  Fonts URL's `display=swap` parameter (kept as-is).
- Upload errors, session-expiry, and network failures now surface a
  specific message via toast/inline error instead of a generic failure
  or (in the session-expiry case) a confusing silent no-op.

## Dependency/build notes

- No bundler/build step existed or was added — this is a small,
  dependency-light vanilla JS frontend, and introducing a build tool
  (Vite/webpack) would add complexity disproportionate to ~1,000 lines of
  frontend code. If the frontend grows significantly, that's the natural
  next step.
- Dependency versions bumped to their current stable minor/patch releases
  (see `CHANGELOG.md`). No major-version bumps were made, since none were
  necessary and each would carry its own breaking-change risk to verify.

## Future scalability (not implemented, noted for when it's needed)

- Replace the flat JSON files with SQLite (via `better-sqlite3`) once file
  counts grow large enough that "parse the whole JSON file on every
  request" becomes a measurable cost — the `database/db.js` module's
  function signatures (`getFiles`/`saveFiles`/`getUsers`/`saveUsers`) were
  kept intentionally simple so swapping the implementation wouldn't
  require touching any controller.
- The in-memory rate limiter (`middleware/rateLimit.js`) resets on
  restart and doesn't share state across multiple server instances; swap
  for a shared store (Redis) if you ever run more than one instance
  behind a load balancer.
- Short-lived signed preview/download URLs (see "Known, accepted
  limitation" above) if per-user access control on those routes becomes a
  requirement.
