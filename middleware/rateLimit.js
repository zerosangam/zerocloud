/**
 * Minimal fixed-window rate limiter. The auth endpoints had no protection
 * at all, so a script could brute-force a password with unlimited
 * attempts. This is intentionally dependency-free; for a multi-instance
 * deployment behind a load balancer, swap this for a shared store
 * (e.g. Redis) — noted in OPTIMIZATION_REPORT.md.
 */
function createRateLimiter({ windowMs, max, message }) {
    const hits = new Map(); // key -> { count, resetAt }

    // Periodically clear stale entries so this Map doesn't grow forever.
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs).unref();

    return function rateLimit(req, res, next) {
        const key = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }

        entry.count += 1;

        if (entry.count > max) {
            const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
            res.set('Retry-After', String(retryAfterSec));
            return res.status(429).json({ success: false, error: message || 'Too many requests, please try again later.' });
        }

        next();
    };
}

module.exports = { createRateLimiter };
