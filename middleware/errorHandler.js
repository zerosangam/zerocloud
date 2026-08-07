const multer = require('multer');

/** Catches unknown /api/* routes with a clean JSON 404 instead of falling
 *  through to the SPA HTML fallback (which previously made every typo'd
 *  API call return a confusing 200 OK with an HTML page as the body). */
function notFoundApi(req, res) {
    res.status(404).json({ success: false, error: 'API route not found' });
}

/** Centralized error handler so no error path returns an unhandled crash
 *  or a raw stack trace to the client. Also translates Multer's specific
 *  errors (e.g. file too large) into friendly messages. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        const message =
            err.code === 'LIMIT_FILE_SIZE'
                ? 'File is too large. Telegram can only reliably serve files up to 20MB.'
                : `Upload error: ${err.message}`;
        return res.status(400).json({ success: false, error: message });
    }

    console.error('Unhandled error:', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
}

module.exports = { notFoundApi, errorHandler };
