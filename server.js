const { PORT } = require('./config/env'); // validates required env vars first, fails fast if missing
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const { securityHeaders } = require('./middleware/security');
const { notFoundApi, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);

app.use('/api', notFoundApi);

// SPA fallback for everything else (client-side routes, direct refreshes, etc.)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log('==========================================');
    console.log('🚀 ZeroCloud running');
    console.log(`📡 http://localhost:${PORT}`);
    console.log('==========================================');
});

// Fail loudly instead of leaving the process in a broken half-alive state.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

function shutdown(signal) {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
    // Force-exit if connections don't close in time.
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
