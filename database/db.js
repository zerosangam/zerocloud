const fs = require('fs');
const path = require('path');

/**
 * Tiny JSON-file "database" with two real fixes over the original:
 *
 * 1. Atomic writes: write to a temp file then rename() over the target,
 *    so a crash mid-write can never leave a truncated/corrupt JSON file.
 * 2. A per-file write queue: concurrent requests that both call save()
 *    used to race (last writer silently wins, dropping the other's
 *    change). Writes are now serialized per file so nothing is lost.
 */

const USERS_FILE = path.join(__dirname, 'users.json');
const FILES_FILE = path.join(__dirname, 'files.json');

const writeQueues = new Map(); // filePath -> Promise chain

function ensureFile(filePath, initialData) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    }
}

function readJSON(filePath, fallback) {
    ensureFile(filePath, fallback);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Database read error (${path.basename(filePath)}):`, error.message);
        return fallback;
    }
}

function writeJSONAtomic(filePath, data) {
    const prev = writeQueues.get(filePath) || Promise.resolve();
    const next = prev
        .catch(() => {}) // don't let one failed write break the chain forever
        .then(() =>
            new Promise((resolve, reject) => {
                const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
                fs.writeFile(tmpPath, JSON.stringify(data, null, 2), (err) => {
                    if (err) return reject(err);
                    fs.rename(tmpPath, filePath, (renameErr) => {
                        if (renameErr) return reject(renameErr);
                        resolve();
                    });
                });
            })
        );
    writeQueues.set(filePath, next);
    return next;
}

// ---- Users ----
function getUsers() {
    return readJSON(USERS_FILE, []);
}
function saveUsers(users) {
    return writeJSONAtomic(USERS_FILE, users);
}

// ---- Files ----
function getFiles() {
    return readJSON(FILES_FILE, []);
}
function saveFiles(files) {
    return writeJSONAtomic(FILES_FILE, files);
}

module.exports = { getUsers, saveUsers, getFiles, saveFiles };
