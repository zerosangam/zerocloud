const crypto = require('crypto');
const { SESSION_SECRET } = require('../config/env');

/**
 * Lightweight, dependency-free session tokens.
 *
 * The previous version of this app trusted an `x-user-id` header sent
 * straight from the browser to decide whose files to list/upload/delete —
 * meaning anyone could read or delete any other user's files just by
 * changing one header. These tokens are signed with a server-side secret
 * (HMAC-SHA256), so a client can no longer forge another user's identity.
 *
 * This intentionally avoids adding a JWT dependency: the format is
 * `base64url(userId).base64url(hmac)`, which is all this app needs.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(userId) {
    const payload = JSON.stringify({ uid: userId, iat: Date.now() });
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const signature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payloadB64)
        .digest('base64url');
    return `${payloadB64}.${signature}`;
}

function verify(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;

    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expected = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payloadB64)
        .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (!payload.uid || !payload.iat) return null;
        if (Date.now() - payload.iat > TOKEN_TTL_MS) return null; // expired
        return payload.uid;
    } catch {
        return null;
    }
}

module.exports = { sign, verify };
