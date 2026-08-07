/**
 * Baseline security headers. Not a full replacement for a package like
 * helmet, but covers the headers that matter for this app without adding
 * a dependency for a handful of `res.set` calls.
 */
function securityHeaders(req, res, next) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
}

module.exports = { securityHeaders };
