"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAlert = notifyAlert;
const config_1 = require("../config");
async function notifyAlert(title, detail) {
    const text = `${title}\n${detail}`.slice(0, 3500);
    const payload = { title, detail, at: new Date().toISOString() };
    if (config_1.config.notifyWebhookUrl) {
        try {
            await fetch(config_1.config.notifyWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        catch (e) {
            console.error('notify webhook failed:', e);
        }
    }
    if (config_1.config.telegramBotToken && config_1.config.telegramChatId) {
        try {
            const url = `https://api.telegram.org/bot${config_1.config.telegramBotToken}/sendMessage`;
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config_1.config.telegramChatId,
                    text: `<b>${escapeHtml(title)}</b>\n<pre>${escapeHtml(detail)}</pre>`,
                    parse_mode: 'HTML',
                }),
            });
        }
        catch (e) {
            console.error('notify telegram failed:', e);
        }
    }
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
//# sourceMappingURL=notify.js.map