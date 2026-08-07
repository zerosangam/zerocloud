const crypto = require('crypto');
const path = require('path');
// 🛠️ FIX: getUsers को भी db.js से इंपोर्ट किया
const { getFiles, saveFiles, getUsers } = require('../database/db');
const telegramService = require('../services/telegramService');

const CATEGORY_MAP = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
    videos: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'],
    audios: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
    documents: ['pdf', 'doc', 'docx', 'txt', 'zip', 'rar', '7z'],
};

function getCategory(ext) {
    const lower = (ext || '').toLowerCase();
    for (const [category, extensions] of Object.entries(CATEGORY_MAP)) {
        if (extensions.includes(lower)) return category;
    }
    return 'others';
}

const FALLBACK_MIME = {
    mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
};

exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file was selected.' });
        }

        // 1. Multer की latin1 एनकोडिंग को सही UTF-8 हिंदी/Unicode नाम में कंवर्ट किया
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        // 2. 🛠️ Database से यूजर का असली Name या Username निकालें
        let uploaderName = req.user?.username || req.user?.name;

        if (!uploaderName) {
            try {
                const users = typeof getUsers === 'function' ? getUsers() : [];
                const foundUser = users.find((u) => u.id === req.userId || u.userId === req.userId);
                if (foundUser) {
                    uploaderName = foundUser.username || foundUser.name || foundUser.email;
                }
            } catch (err) {
                console.error("User name fetch error:", err.message);
            }
        }

        // अगर फिर भी नाम न मिले तो ही ID यूज़ करें
        uploaderName = uploaderName || req.userId || 'Unknown User';

        // 3. Telegram पर File और User का Name भेजें
        const telegramFileId = await telegramService.sendDocument(
            req.file.buffer,
            originalName,
            req.file.mimetype,
            uploaderName
        );

        const ext = path.extname(originalName).replace('.', '').toLowerCase();

        const newFile = {
            id: 'file_' + crypto.randomUUID(),
            originalName: originalName,
            extension: ext,
            size: req.file.size,
            mimeType: req.file.mimetype || 'application/octet-stream',
            category: getCategory(ext),
            telegramFileId,
            uploadTime: new Date().toISOString(),
            userId: req.userId,
        };

        const files = getFiles();
        files.push(newFile);
        await saveFiles(files);

        res.status(201).json({ success: true, file: newFile });
    } catch (error) {
        console.error('Upload error:', error.response?.data || error.message);
        res.status(502).json({ success: false, error: 'Upload to storage backend failed. Please try again.' });
    }
};

exports.getFiles = (req, res, next) => {
    try {
        const files = getFiles();
        const userFiles = files.filter((f) => f.userId === req.userId);
        const totalBytes = userFiles.reduce((sum, f) => sum + (f.size || 0), 0);

        res.json({
            success: true,
            files: [...userFiles].reverse(),
            totalBytes,
        });
    } catch (err) {
        next(err);
    }
};

exports.previewFile = async (req, res) => {
    try {
        const file = getFiles().find((f) => f.id === req.params.id);
        if (!file) return res.status(404).send('File not found');

        const streamRes = await telegramService.streamFile(file.telegramFileId, req.headers.range);

        let mime = file.mimeType;
        if (!mime || mime === 'application/octet-stream') {
            mime = FALLBACK_MIME[file.extension] || 'application/octet-stream';
        }

        res.status(streamRes.status);
        res.set({
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
            'Content-Length': streamRes.headers['content-length'],
            'Content-Range': streamRes.headers['content-range'] || undefined,
            'Cache-Control': 'private, max-age=3600',
            'Content-Disposition': 'inline',
        });

        streamRes.data.pipe(res);
    } catch (error) {
        console.error('Preview error:', error.message);
        if (!res.headersSent) res.status(502).send('Streaming error');
    }
};

exports.downloadFile = async (req, res) => {
    try {
        const file = getFiles().find((f) => f.id === req.params.id);
        if (!file) return res.status(404).send('File not found');

        const streamRes = await telegramService.streamFile(file.telegramFileId);

        const encodedName = encodeURIComponent(file.originalName);
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        });

        streamRes.data.pipe(res);
    } catch (error) {
        console.error('Download error:', error.message);
        if (!res.headersSent) res.status(502).send('Download failed');
    }
};

exports.deleteFile = async (req, res, next) => {
    try {
        const files = getFiles();
        const index = files.findIndex((f) => f.id === req.params.id && f.userId === req.userId);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'File not found, or you do not have permission to delete it.' });
        }

        files.splice(index, 1);
        await saveFiles(files);

        res.json({ success: true, message: 'File deleted.' });
    } catch (err) {
        next(err);
    }
};