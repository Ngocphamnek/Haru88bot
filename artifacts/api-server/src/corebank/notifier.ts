import { getSettings } from './settings.js';

export const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const notifyTelegram = async (message: string) => {
  const settings = getSettings();
  if (!settings.telegram.enabled || !settings.telegram.botToken || !settings.telegram.chatId) return;

  try {
    const url = `https://api.telegram.org/bot${settings.telegram.botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: settings.telegram.chatId, text: message, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: any) {
    console.error('Telegram notification failed:', error.message);
  }
};

export const notifyDiscord = async (content: string, embed?: any) => {
  const settings = getSettings();
  if (!settings.discord.enabled || !settings.discord.webhookUrl) return;

  try {
    const payload: any = { content };
    if (embed) payload.embeds = [embed];
    await fetch(settings.discord.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: any) {
    console.error('Discord notification failed:', error.message);
  }
};

export const notifyCustomWebhook = async (transaction: any) => {
  const settings = getSettings();
  if (!settings.customWebhook.enabled || !settings.customWebhook.url) return;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.customWebhook.secret) headers['X-Webhook-Secret'] = settings.customWebhook.secret;
    await fetch(settings.customWebhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'success', ...transaction }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error: any) {
    console.error('Custom webhook failed:', error.message);
  }
};

export const notifyMatchedDeposit = async (
  callbackUrl: string,
  secret: string | undefined,
  payload: Record<string, unknown>
): Promise<void> => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['X-Webhook-Secret'] = secret;

    const resp = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    console.log(`📤 Matched deposit callback sent → HTTP ${resp.status}`);
  } catch (error: any) {
    console.error('Matched deposit callback failed:', error.message);
  }
};

export const triggerTestNotification = async () => {
  const testTx = {
    transactionId: 'TEST-' + Date.now(),
    refNo: 'TEST-' + Date.now(),
    creditAmount: 50000,
    debitAmount: 0,
    description: 'TEST NOTIFICATION CORE BANK TOOL PRO',
    transactionDate: new Date().toLocaleString(),
    accountNo: '0987654321',
  };
  await broadcastTransaction(testTx, true);
  return { success: true };
};

export const broadcastTransaction = async (tx: any, isTest = false) => {
  const isCredit = tx.creditAmount > 0;
  const amount = isCredit ? tx.creditAmount : tx.debitAmount;
  const typeStr = isCredit ? 'Nhận tiền (+)' : 'Trừ tiền (-)';
  const emoji = isCredit ? '🟢' : '🔴';
  const title = isTest ? '🔔 TEST NOTIFICATION' : '🔔 BIẾN ĐỘNG SỐ DƯ';

  const telegramMsg =
    `<b>${title}</b>\n\n` +
    `🏦 <b>Tài khoản:</b> ${tx.accountNo}\n` +
    `📅 <b>Thời gian:</b> ${tx.transactionDate}\n` +
    `💳 <b>Loại:</b> ${emoji} ${typeStr}\n` +
    `💰 <b>Số tiền:</b> ${formatMoney(amount)}\n` +
    `📝 <b>Nội dung:</b> <i>${tx.description}</i>\n` +
    `🔖 <b>Mã GD:</b> <code>${tx.refNo}</code>`;

  const discordEmbed = {
    title,
    color: isCredit ? 0x67c23a : 0xf56c6c,
    fields: [
      { name: 'Tài khoản', value: tx.accountNo || 'Unknown', inline: true },
      { name: 'Loại', value: `${emoji} ${typeStr}`, inline: true },
      { name: 'Số tiền', value: formatMoney(amount), inline: true },
      { name: 'Nội dung', value: tx.description || 'N/A' },
      { name: 'Mã GD', value: tx.refNo || 'N/A', inline: true },
      { name: 'Thời gian', value: tx.transactionDate || 'N/A', inline: true },
    ],
    footer: { text: 'Core Bank Tool PRO' },
    timestamp: new Date().toISOString(),
  };

  await Promise.allSettled([
    notifyTelegram(telegramMsg),
    notifyDiscord('', discordEmbed),
    notifyCustomWebhook(tx),
  ]);
};
