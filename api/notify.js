import { OWNER, TELEGRAM_CHANNEL_USERNAME } from './config.js';

const escapeCode = (value = '') => String(value).replace(/```/g, "ˋˋˋ").replace(/\u0000/g, '').slice(0, 3000);
const json = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
const configured = value => Boolean(value && !String(value).includes('GANTI_') && !String(value).includes('123456789'));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return json(res, 400, { error: 'Body request tidak valid.' });

  const name = String(body.name || '').trim().slice(0, 80);
  const telegramId = String(body.telegramId || '').trim();
  const type = String(body.type || 'Auto Request').trim().slice(0, 120);
  const message = String(body.message || '').trim();
  const destination = body.destination === 'channel' ? 'channel' : body.destination === 'owner' ? 'owner' : '';
  if (!name || !/^[0-9]{5,20}$/.test(telegramId) || !type || !message || message.length > 3000 || !destination) {
    return json(res, 400, { error: 'Data request tidak lengkap atau tidak valid.' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return json(res, 500, { error: 'TELEGRAM_BOT_TOKEN belum diisi di Vercel → Project Settings → Environment Variables.' });

  let chatId;
  if (destination === 'owner') {
    if (!configured(OWNER.telegramId)) return json(res, 500, { error: 'ID Telegram owner belum diatur. Edit api/config.js → OWNER.telegramId.' });
    chatId = OWNER.telegramId;
  } else {
    if (!configured(TELEGRAM_CHANNEL_USERNAME)) return json(res, 500, { error: 'Username channel belum diatur. Edit api/config.js → TELEGRAM_CHANNEL_USERNAME.' });
    chatId = TELEGRAM_CHANNEL_USERNAME;
  }

  const ownerName = configured(OWNER.name) ? OWNER.name : 'Owner REQ BOT';
  const ownerRole = configured(OWNER.role) ? OWNER.role : 'Owner';
  const timestamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date());
  const text = [
    '📩 REQUEST BARU — REQ BOT',
    '```',
    `Tujuan       : ${destination === 'channel' ? 'Channel Telegram' : 'Owner pribadi'}`,
    `Owner        : ${escapeCode(ownerName)}`,
    `Role         : ${escapeCode(ownerRole)}`,
    `Nama user    : ${escapeCode(name)}`,
    `Telegram ID  : ${telegramId}`,
    `Jenis        : ${escapeCode(type)}`,
    `Waktu WIB    : ${timestamp}`,
    '```',
    'DETAIL REQUEST',
    '```',
    escapeCode(message),
    '```'
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const description = result.description || 'Telegram gagal mengirim notifikasi.';
      return json(res, 502, { error: `Telegram menolak pengiriman: ${description}. Pastikan bot sudah /start ke owner atau sudah menjadi admin channel.` });
    }
    return json(res, 200, { ok: true, destination, message: `Notifikasi berhasil dikirim ke ${destination === 'channel' ? 'channel' : 'owner'}.` });
  } catch {
    return json(res, 502, { error: 'Tidak dapat terhubung ke Telegram. Coba lagi nanti.' });
  }
}
