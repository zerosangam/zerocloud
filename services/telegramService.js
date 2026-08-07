const axios = require('axios');
const FormData = require('form-data');
const { BOT_TOKEN, CHANNEL_ID } = require('../config/env');

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

/**
 * All direct Telegram Bot API calls live here, isolated from Express
 * request/response handling so the controller stays focused on HTTP
 * concerns and this module can be unit-tested or swapped out on its own.
 */

async function sendDocument(buffer, filename, mimeType, uploaderName) {
    const formData = new FormData();
    formData.append('chat_id', CHANNEL_ID);
    formData.append('document', buffer, {
        filename,
        contentType: mimeType || 'application/octet-stream',
    });

    // 🛠️ Telegram par sirf User ka Name Caption me dikhane ke liye
    if (uploaderName) {
        formData.append('caption', `👤 user: ${uploaderName}`);
    }

    const { data } = await axios.post(`${API_BASE}/sendDocument`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });

    if (!data || !data.ok) {
        throw new Error(data?.description || 'Telegram upload failed');
    }

    const result = data.result;
    const tgFile =
        result.document ||
        result.video ||
        result.audio ||
        (result.photo ? result.photo[result.photo.length - 1] : null);

    if (!tgFile) {
        throw new Error('Telegram did not return a file_id for the upload');
    }

    return tgFile.file_id;
}

async function resolveFilePath(fileId) {
    const { data } = await axios.get(`${API_BASE}/getFile`, { params: { file_id: fileId } });
    if (!data || !data.ok) {
        throw new Error(data?.description || 'File no longer available on Telegram');
    }
    return data.result.file_path;
}

async function streamFile(telegramFileId, rangeHeader) {
    const filePath = await resolveFilePath(telegramFileId);
    const url = `${FILE_BASE}/${filePath}`;
    const headers = rangeHeader ? { Range: rangeHeader } : {};

    return axios({
        method: 'get',
        url,
        responseType: 'stream',
        headers,
        validateStatus: (status) => status < 500,
    });
}

module.exports = { sendDocument, resolveFilePath, streamFile };