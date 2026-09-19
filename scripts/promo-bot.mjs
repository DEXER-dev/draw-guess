import WebSocket from 'ws';

const base = process.env.PROMO_BASE || 'http://127.0.0.1:3180';
const code = String(process.argv[2] || '').toUpperCase();
if (!code) throw new Error('usage: node scripts/promo-bot.mjs ROOMCODE');

async function join(nickname) {
  const response = await fetch(`${base}/api/rooms/${code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!response.ok) throw new Error(`join ${response.status}`);
  return response.json();
}

function connect(player, onMessage) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ws`);
  ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', roomCode: code, playerId: player.id, token: player.token })));
  ws.on('message', (raw) => {
    try { onMessage(ws, JSON.parse(String(raw))); } catch { /* keep the promo session alive */ }
  });
  return ws;
}

const host = {
  id: process.env.PROMO_HOST_ID,
  token: process.env.PROMO_HOST_TOKEN,
  nickname: 'PV主持',
};
if (!host.id || !host.token) throw new Error('PROMO_HOST_ID and PROMO_HOST_TOKEN are required');
const guestData = await join('PV玩家');
let started = false;

connect(host, (ws, msg) => {
  if (msg.type === 'room_state' && msg.room?.phase === 'waiting' && (msg.players || []).length >= 2 && !started) {
    started = true;
    ws.send(JSON.stringify({ type: 'start_game' }));
  }
  if (msg.type === 'word_options') ws.send(JSON.stringify({ type: 'choose_word', index: 0 }));
  if (msg.type === 'room_state' && msg.room?.phase === 'finished') ws.send(JSON.stringify({ type: 'play_again' }));
});

connect(guestData.player, (ws, msg) => {
  if (msg.type === 'word_options') ws.send(JSON.stringify({ type: 'choose_word', index: 0 }));
});

setTimeout(() => process.exit(0), 150000);
