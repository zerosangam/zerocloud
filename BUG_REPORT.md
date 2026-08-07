# Bug Report

See `SECURITY_NOTICE.md` first for the leaked-credentials issue — that's
more urgent than anything below.

## Critical

### 1. Broken environment variable name (upload was non-functional)
`controllers/fileController.js` read `process.env.TELEGRAM_CHAT_ID`, but
`.env` defines `CHANNEL_ID`. `TELEGRAM_CHAT_ID` was always `undefined`, so
every upload sent `chat_id: undefined` to Telegram and would fail.
**Fix:** standardized on `CHANNEL_ID` everywhere (`config/env.js`,
`services/telegramService.js`), validated at boot so this class of bug
fails immediately with a clear message instead of silently at request time.

### 2. Any user could read, upload as, or delete another user's files
Every protected route trusted a plain `x-user-id` header that the
**browser's own JavaScript** set on each request:
```js
const userId = req.headers['x-user-id'];
```
Since the client fully controls its own request headers, anyone could open
dev tools and change that header to another user's id to list, upload
under, or delete that user's files. There was no verification that the
request actually came from a logged-in session for that id.
**Fix:** `/api/auth/login` and `/api/auth/register` now issue a signed
token (`services/tokenService.js`, HMAC-SHA256). Protected routes go
through `middleware/auth.js`, which verifies the signature and only then
trusts the user id it contains. A forged header can no longer impersonate
another user.

### 3. Passwords stored and compared in plain text
`db.json` had `"password": "12345678"` and similar in plain text, and
login did `user.password === password`. Anyone with read access to the
JSON file (or a backup of it) had every user's real password.
**Fix:** `services/passwordService.js` hashes passwords with `scrypt`
(salted, memory-hard) before they ever touch disk; `authController.js`
verifies with a timing-safe comparison.

### 4. Files over 20MB uploaded "successfully" then could never be opened
The upload limit was 50MB, but Telegram's Bot API `getFile` — which
`previewFile`/`downloadFile` depend on — only returns file paths for files
up to 20MB. A 21–50MB upload would appear to succeed, then every future
preview/download attempt would fail with "file expired," with no
indication why.
**Fix:** upload limit lowered to 20MB (`config/env.js`,
`routes/fileRoutes.js`) with a clear client-side check
(`public/script.js`) and a friendly server error message
(`middleware/errorHandler.js`) instead of a silent later failure.

## High

### 5. No rate limiting on login/register
Both endpoints accepted unlimited attempts, making password brute-forcing
trivial once combined with bug #3's weak passwords. **Fix:**
`middleware/rateLimit.js` caps auth attempts to 10 per 5 minutes per IP.

### 6. Stored XSS via uploaded filenames
`public/script.js` built file cards with template-literal `innerHTML`
using `file.originalName` directly:
```js
card.innerHTML = `<div ... title="${file.originalName}">${file.originalName}</div>`;
```
A file uploaded with a name like `"><img src=x onerror=alert(document.cookie)>.png`
would execute as script the next time any user's dashboard rendered the
file list. **Fix:** file cards are now built with DOM APIs
(`createElement`/`textContent`) instead of string-interpolated HTML, so
filenames are always treated as inert text, never markup.

### 7. Unserialized, non-atomic JSON "database" writes
`saveDB()` did a single synchronous `fs.writeFileSync` with no
concurrency control. Two requests finishing close together (e.g. two
uploads at once) could interleave and one write would silently overwrite
the other's change; a crash mid-write could also leave truncated,
unparseable JSON. **Fix:** `database/db.js` now queues writes per file and
writes atomically (write to a temp file, then `rename()` over the target).

### 8. Predictable, enumerable file/user IDs
IDs were `'file_' + Date.now()` / `'user_' + Date.now()`, which are
sequential and guessable within a small time window. Combined with bug #2,
this made it easy to enumerate other users' file IDs. **Fix:** IDs are now
`crypto.randomUUID()`-based, which are not practically guessable.

## Medium

### 9. Multer file-size errors had nowhere to go
`routes/fileRoutes.js` set a Multer upload limit, but there was no
Multer-specific error handling anywhere in the request pipeline, so a
too-large file would reach Express's default error handler and return an
unstyled stack trace to the browser instead of a usable error message.
**Fix:** Multer errors are now caught in one place
(`middleware/errorHandler.js`) and translated into a friendly JSON message.

### 10. No 404 handler for unknown `/api/*` routes
Any typo'd API path (e.g. `/api/upload2`) fell through to the SPA's
catch-all `res.sendFile(index.html)` and returned `200 OK` with an HTML
page as the body — confusing for any API consumer, and impossible to
detect programmatically as an error. **Fix:** `middleware/errorHandler.js`
adds a dedicated JSON 404 for unmatched `/api/*` routes, registered before
the SPA fallback.

### 11. No input validation on register/login
Empty strings, extremely long usernames, or non-string bodies were
accepted and would either crash on `.toLowerCase()` of a non-string or
silently create odd accounts. **Fix:** `authController.js` validates
username format/length and a minimum password length before touching the
database.

### 12. No security response headers
`X-Powered-By: Express` was sent on every response (fingerprinting), and
there were no `X-Content-Type-Options`, `X-Frame-Options`, or
`Referrer-Policy` headers. **Fix:** `middleware/security.js` +
`app.disable('x-powered-by')` in `server.js`.

### 13. No graceful shutdown / unhandled rejection handling
An unhandled promise rejection (e.g. a network error in an `async` route
not wrapped correctly) had no global handler, and `SIGTERM`/`SIGINT` just
killed the process mid-request. **Fix:** added in `server.js`.

## Low / UX

### 14. Dropzone was mouse-only
The "click to browse" area used an inline `onclick` on a plain `<div>`,
unreachable by keyboard and invisible to screen readers. **Fix:** it's now
`role="button" tabindex="0"` with both click and `Enter`/`Space` key
handlers (`public/script.js`, `public/index.html`).

### 15. No responsive breakpoints at all
`style.css` had zero `@media` queries — the fixed 350px search box and
multi-column layouts didn't adapt to phone-sized viewports. **Fix:** see
`OPTIMIZATION_REPORT.md` for the responsive rules added.

### 16. Confusing/duplicate database files
The upload contained `database/files.json` (combined users+files store,
actually used by `db.js`), an unused empty `database/users.json`, *and* an
unrelated root-level `db.json` with real leaked user data. **Fix:**
`database/users.json` and `database/files.json` are now the actual,
separately-used stores; the stray root `db.json` is removed.
