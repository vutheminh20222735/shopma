import { config } from '@server/shared/config';

export type MailMessage = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

export function mailConfigured() {
    return Boolean(config.mail.host && config.mail.user && config.mail.pass);
}

export async function sendMail(message: MailMessage) {
    if (!mailConfigured()) {
        console.log('[mail] SMTP chưa cấu hình. Nội dung email:');
        console.log(`To: ${message.to}`);
        console.log(`Subject: ${message.subject}`);
        console.log(message.text);
        return { delivered: false, logged: true };
    }
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: { user: config.mail.user, pass: config.mail.pass },
    });
    await transporter.sendMail({
        from: config.mail.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html || message.text.replace(/\n/g, '<br>'),
    });
    return { delivered: true, logged: false };
}
