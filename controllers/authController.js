const crypto = require('crypto');
const { getUsers, saveUsers } = require('../database/db');
const passwordService = require('../services/passwordService');
const tokenService = require('../services/tokenService');

const USERNAME_RE = /^[a-zA-Z0-9_.\- ]{3,32}$/;

function publicUser(user) {
    return { id: user.id, username: user.username };
}

exports.register = async (req, res, next) => {
    try {
        const { username, password } = req.body || {};

        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ success: false, error: 'Username and password are required.' });
        }
        const trimmedUsername = username.trim();
        if (!USERNAME_RE.test(trimmedUsername)) {
            return res.status(400).json({
                success: false,
                error: 'Username must be 3-32 characters (letters, numbers, spaces, _ . -).',
            });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
        }

        const users = getUsers();
        const exists = users.some((u) => u.username.toLowerCase() === trimmedUsername.toLowerCase());
        if (exists) {
            return res.status(409).json({ success: false, error: 'That username is already registered.' });
        }

        const newUser = {
            id: 'user_' + crypto.randomUUID(),
            username: trimmedUsername,
            passwordHash: passwordService.hash(password),
            createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        await saveUsers(users);

        const token = tokenService.sign(newUser.id);
        res.status(201).json({ success: true, user: publicUser(newUser), token });
    } catch (err) {
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body || {};
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ success: false, error: 'Username and password are required.' });
        }

        const users = getUsers();
        const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

        // Always run a hash comparison, even when the user doesn't exist,
        // so the response time doesn't leak whether the username is valid.
        const isValid = user ? passwordService.verify(password, user.passwordHash) : (passwordService.verify(password, passwordService.hash('decoy-password')), false);

        if (!user || !isValid) {
            return res.status(401).json({ success: false, error: 'Incorrect username or password.' });
        }

        const token = tokenService.sign(user.id);
        res.json({ success: true, user: publicUser(user), token });
    } catch (err) {
        next(err);
    }
};
