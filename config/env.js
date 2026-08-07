require('dotenv').config();
const crypto = require('crypto');

/**
 * Central place where every environment variable the app needs is read,
 * validated, and (where sensible) given a safe default.
 *
 * Fails fast with a clear message if a truly required variable is missing,
 * instead of letting the app boot and crash later on the first request.
 */

const REQUIRED = ['BOT_TOKEN', 'CHANNEL_ID'];
const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim());

if (missing.length) {
    console.error('==========================================');
    console.error('❌ Missing required environment variable(s):');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('   Copy .env.example to .env and fill these in.');
    console.error('==========================================');
    process.exit(1);
}

// SESSION_SECRET signs auth tokens. It's not strictly required to boot the
// app (so a fresh clone still runs), but every restart without one
// invalidates existing sessions. We generate an ephemeral one and warn
// loudly rather than hard-failing, since this is a personal/self-hosted app.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || !sessionSecret.trim()) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('==========================================');
    console.warn('⚠️  SESSION_SECRET is not set in your .env file.');
    console.warn('   A random secret was generated for this run only.');
    console.warn('   Every existing login session will be invalidated');
    console.warn('   whenever the server restarts until you set a');
    console.warn('   permanent SESSION_SECRET in .env.');
    console.warn('==========================================');
}

module.exports = {
    PORT: parseInt(process.env.PORT, 10) || 3000,
    BOT_TOKEN: process.env.BOT_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID,
    SESSION_SECRET: sessionSecret,
    NODE_ENV: process.env.NODE_ENV || 'development',
    // Telegram's Bot API can only *download* files up to 20MB via getFile,
    // even though a bot can *upload* up to 50MB. Anything bigger uploads
    // "successfully" and then can never be previewed or downloaded again.
    MAX_UPLOAD_BYTES: 20 * 1024 * 1024,
};
