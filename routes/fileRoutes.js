const express = require('express');
const router = express.Router();
const multer = require('multer');
const fileController = require('../controllers/fileController');
const { requireAuth } = require('../middleware/auth');
const { MAX_UPLOAD_BYTES } = require('../config/env');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Everything below requires a valid, signed session token (see middleware/auth.js).
router.post('/upload', requireAuth, upload.single('file'), fileController.uploadFile);
router.get('/files', requireAuth, fileController.getFiles);
router.delete('/delete/:id', requireAuth, fileController.deleteFile);

// Preview/download are reached via <img src>, <video>, and <a download> tags,
// which can't attach an Authorization header — so these stay keyed by the
// file's unguessable UUID rather than a login check. Same trust model as
// a typical "anyone with the link" share URL. See SECURITY_NOTICE.md.
router.get('/preview/:id', fileController.previewFile);
router.get('/download/:id', fileController.downloadFile);

module.exports = router;
