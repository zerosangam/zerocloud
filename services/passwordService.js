const crypto = require('crypto');

/**
 * Password hashing using Node's built-in scrypt — no extra dependency
 * (like bcrypt) required, no native compilation, and it's a modern,
 * memory-hard KDF. Previously passwords were stored and compared as
 * plain text in the JSON "database".
 */

const KEY_LENGTH = 64;

function hash(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
    return `${salt}:${derivedKey.toString('hex')}`;
}

function verify(password, stored) {
    if (!stored || !stored.includes(':')) return false;
    const [salt, hashHex] = stored.split(':');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (storedBuf.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, storedBuf);
}

module.exports = { hash, verify };
