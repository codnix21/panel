import { config } from '../config';

export async function notifyAlert(title: string, detail: string): Promise<void> {
  const text = `${title}\n${detail}`.slice(0, 3500);
  const payload = { title, detail, at: new Date().toISOString() };

  if (config.notifyWebhookUrl) {
    try {
      await fetch(config.notifyWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('notify webhook failed:', e);
    }
  }

  if (config.telegramBotToken && config.telegramChatId) {
    try {
      const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: `<b>${escapeHtml(title)}</b>\n<pre>${escapeHtml(detail)}</pre>`,
          parse_mode: 'HTML',
        }),
      });
    } catch (e) {
      console.error('notify telegram failed:', e);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
