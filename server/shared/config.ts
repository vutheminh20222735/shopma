import path from 'node:path';

const port = Number(process.env.PORT || 3001);
const sessionDays = Number(process.env.SESSION_DAYS || 7);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');
if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 30) throw new Error('SESSION_DAYS phải từ 1 đến 30.');
const appUrl = new URL(process.env.APP_ORIGIN || 'http://localhost:5173');
if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.origin !== (process.env.APP_ORIGIN || 'http://localhost:5173')) {
    throw new Error('APP_ORIGIN phải là origin HTTP/HTTPS, không có đường dẫn hoặc dấu / cuối.');
}
const allowedOrigins = new Set([appUrl.origin]);
if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(appUrl.hostname)) {
    for (const host of ['localhost', '127.0.0.1']) {
        allowedOrigins.add(`http://${host}:${port}`);
        allowedOrigins.add(`http://${host}:${process.env.CLIENT_PORT || 5173}`);
    }
}
const smtpPort = Number(process.env.SMTP_PORT || 587);
export const config = {
    projectRoot: process.cwd(), port, host: process.env.HOST || '127.0.0.1',
    appOrigin: appUrl.origin, allowedOrigins, secureCookie: appUrl.protocol === 'https:',
    sessionMilliseconds: sessionDays * 86400000,
    databasePath: path.resolve(process.env.DATABASE_PATH || 'database/data/ma-shop.sqlite'),
    passwordResetMinutes: 15,
    mail: {
        host: process.env.SMTP_HOST || '',
        port: Number.isInteger(smtpPort) ? smtpPort : 587,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'M&A Shop <noreply@ma-shop.local>',
        debug: process.env.MAIL_DEBUG === '1' || process.env.NODE_ENV === 'test',
    },
};
