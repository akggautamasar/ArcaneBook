ArcaneBook security migration patch. Copy these files into the repository preserving paths.
Required Vercel server environment variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, ADMIN_PASSWORD.
Do not define VITE_TELEGRAM_BOT_TOKEN or VITE_MASTER_PASSWORD.
API is implemented as api/index.js and accessible via /api?action=...
Known limitations: Telegram pinned-message index ~4KB and concurrent writes are not safe; migrate to database for production scale. HTML quizzes are untrusted documents; browser Blob HTML execution is not a security sandbox. Consider sandboxed iframe/subdomain. Login rate limiting is not implemented; add WAF/rate limiting before production.
