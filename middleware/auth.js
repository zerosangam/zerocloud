const tokenService = require('../services/tokenService');

/**
 * Previously every protected route did:
 *   const userId = req.headers['x-user-id'];
 * which is a header the *browser* sets from a value the *client-side
 * JavaScript* controls — so any user could impersonate any other user
 * simply by sending a different id. This middleware instead verifies a
 * cryptographically signed token issued at login/register, and only
 * trusts the user id recovered from a valid signature.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    const userId = tokenService.verify(token);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Session invalid or expired. Please log in again.' });
    }

    req.userId = userId;
    next();
}

module.exports = { requireAuth };
