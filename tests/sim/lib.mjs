import http from 'node:http';
import { WebSocket } from 'ws';

export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: urlPath,
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch { /* non json */ }
          resolve({ status: res.statusCode, json, text: data });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

export class Bot {
  constructor(harness, nickname) {
    this.h = harness;
    this.name = nickname;
    this.ws = null;
    this.msgs = [];
    this.read = 0;
    this.listeners = new Map();
    this.id = null;
    this.token = null;
    this.isHost = false;
    this.roomCode = null;
    this.dropped = false;
    this.phase = 'waiting';
  }

  async create(opts = {}) {
    const r = await request(this.h.port, 'POST', '/api/rooms', { nickname: this.name, ...opts });
    if (r.status !== 201) throw new Error(`create failed ${r.status} ${r.text}`);
    this.id = r.json.player.id;
    this.token = r.json.player.token;
    this.isHost = true;
    this.roomCode = r.json.room.code;
    this.h.rooms.push({ code: this.roomCode, host: this });
    return r.json;
  }

  async join(code, extra = {}) {
    const r = await request(this.h.port, 'POST', `/api/rooms/${code}/join`, { nickname: this.name, ...extra });
    if (r.status !== 200) { this.h.note(`join ${this.name} -> ${r.status} ${JSON.stringify(r.json)}`); return { status: r.status, json: r.json }; }
    this.id = r.json.player.id;
    this.token = r.json.player.token;
    this.isHost = r.json.player.isHost;
    this.roomCode = code;
    return r.json;
  }

  async rejoin(code) {
    const r = await request(this.h.port, 'POST', `/api/rooms/${code}/rejoin`, {
      playerId: this.id, token: this.token, nickname: this.name,
    });
    return r;
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
    return this;
  }

  async connect() {
    await this._openSocket();
    return this;
  }

  async _openSocket() {
    const ws = new WebSocket(`ws://127.0.0.1:${this.h.port}/ws`, { headers: { origin: `http://127.0.0.1:${this.h.port}` } });
    this.ws = ws;
    this.dropped = false;
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
      setTimeout(() => reject(new Error(`${this.name}: ws open timeout`)), 4000);
    });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { this.h.fail('bad-json', `${this.name} received non json frame`); return; }
      msg._t = Date.now();
      this.msgs.push(msg);
      if (msg.type === 'phase_changed') this.phase = msg.phase;
      else if (msg.type === 'room_state') this.phase = msg.phase;
      this.h.tap(this, msg);
      const list = this.listeners.get(msg.type);
      if (list) for (const fn of list) { try { fn(msg, this); } catch (e) { this.h.fail('bot-handler', `${this.name} ${msg.type}: ${e.message}`); } }
      const once = this.listeners.get(`once:${msg.type}`);
      if (once) { this.listeners.delete(`once:${msg.type}`); for (const fn of once) { try { fn(msg, this); } catch (e) { this.h.fail('bot-handler', e.message); } } }
    });
    ws.on('close', (code, reason) => { this.h.note(`ws-closed ${this.name} code=${code} reason=${String(reason)}`); });
    ws.on('error', (e) => { this.h.note(`ws-error ${this.name} ${e.message}`); });
    ws.send(JSON.stringify({ type: 'auth', roomCode: this.roomCode, playerId: this.id, token: this.token }));
    return this;
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) { this.h.note(`send-dropped ${this.name} ${obj.type}`); return false; }
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  drop() {
    this.dropped = true;
    if (this.ws) { this.ws.terminate(); this.ws = null; }
  }

  async reconnect() {
    if (this.ws) this.ws.terminate();
    this.dropped = false;
    this.read = this.msgs.length;
    await this._openSocket();
    return this;
  }

  leaveRoom() { this.left = true; this.send({ type: 'leave' }); }

  // 掉线/已退出的机器人收不到广播，等待广播时必须换一个在线观察者
  live() { return !this.dropped && !this.left && !!this.ws && this.ws.readyState === WebSocket.OPEN; }

  async waitFor(type, pred = () => true, timeout = 6000) {
    const from = this.read;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      for (let i = from; i < this.msgs.length; i += 1) {
        const m = this.msgs[i];
        if (m.type === type && pred(m, i)) { this.read = i + 1; return m; }
      }
      await sleep(10);
    }
    const tail = this.msgs.slice(-12).map((m) => m.type).join(',');
    throw new Error(`${this.name}: timeout waiting '${type}' (last types: ${tail})`);
  }

  mark() { this.read = this.msgs.length; }
}

export class Harness {
  constructor({ port, label }) {
    this.port = port;
    this.label = label;
    this.bots = [];
    this.rooms = [];
    this.issues = [];
    this.notes = [];
    this.checks = 0;
    this.words = new Map();
    this.currentTurn = null;
    this.oracle = { relayWords: new Map(), relayBooks: [] };
    this.expectedErrors = ['not_drawer']; // 竞态噪音：回合结束瞬间仍在发笔画，服务端逐条回 error
  }

  async bot(name) {
    const b = new Bot(this, name);
    this.bots.push(b);
    return b;
  }

  ok(label, detail = '') { this.checks += 1; this.notes.push(`PASS ${label}${detail ? ` ${detail}` : ''}`); }

  fail(kind, label, detail = '') {
    this.issues.push({ kind, label, detail });
    console.log(`  [X] ${kind}: ${label}${detail ? ` :: ${detail}` : ''}`);
  }

  expect(cond, label, detail = '') {
    if (cond) { this.ok(label); return true; }
    this.fail('assert', label, detail);
    return false;
  }

  note(text) { this.notes.push(text); if (text.startsWith('ws-closed') === false) console.log(`  · ${text}`); }

  resetWords() { this.words.clear(); }

  tap(bot, msg) {
    if (msg.type === 'private_word') {
      this.words.set(`${msg.round}:${msg.turnInRound}`, msg.word);
    }
    if (msg.type === 'word_options') {
      this.words.set(`options:${msg.round}:${msg.turnInRound}`, msg.options.map((o) => o.word).join('/'));
    }
    if (msg.type === 'relay_task' && msg.kind === 'draw' && msg.promptWord) {
      this.oracle.relayWords.set(msg.bookIndex, msg.promptWord);
    }
    if (msg.type === 'phase_changed') {
      const valid = ['waiting', 'prepare', 'drawing', 'result', 'finished', 'relay_intro', 'relay_draw', 'relay_guess', 'relay_collect', 'relay_reveal'];
      if (!valid.includes(msg.phase)) this.fail('protocol', `unknown phase '${msg.phase}'`);
      if (msg.round != null && msg.round > msg.totalRounds + 1) this.fail('invariant', `round ${msg.round} > totalRounds ${msg.totalRounds}`);
      if (msg.turnInRound != null && msg.playersPerRound != null && msg.turnInRound > msg.playersPerRound) {
        this.fail('invariant', `turnInRound ${msg.turnInRound} > playersPerRound ${msg.playersPerRound}`, `phase=${msg.phase} round=${msg.round}`);
      }
      if (msg.phase === 'prepare' || msg.phase === 'drawing') {
        this.currentTurn = { round: msg.round, turnInRound: msg.turnInRound, drawerId: msg.drawerId };
      }
      // 泄题检查：masked 不应暴露任何未揭示的字符
      if (msg.wordMasked && this.currentTurn) {
        const answer = this.words.get(`${msg.round}:${msg.turnInRound}`);
        if (answer && msg.phase === 'drawing') {
          const chars = Array.from(answer);
          const masked = msg.wordMasked.split(' ');
          let leaked = 0;
          chars.forEach((ch, i) => {
            if (/\s/.test(ch)) return;
            if (masked[i] && masked[i] !== '_' && masked[i] !== '＿') leaked += 1;
          });
          if (leaked) this.fail('leak', `wordMasked 泄漏了 ${leaked} 个字符`, `word=${answer} mask=${msg.wordMasked}`);
        }
      }
    }
    if (msg.type === 'error' && !this.expectedErrors.includes(msg.code)) {
      this.fail('server-error', `error ${msg.code}`, `to=${bot.name} msg=${msg.message}`);
    }
  }

  expectErrorCodes(...codes) { this.expectedErrors = codes; }

  async waitWord(turn, timeout = 3000) {
    const key = `${turn.round}:${turn.turnInRound}`;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (this.words.has(key)) return this.words.get(key);
      await sleep(10);
    }
    return null;
  }

  report() {
    return { label: this.label, checks: this.checks, issues: this.issues, notes: this.notes };
  }
}

export function drawStrokes(bot, ms, opts = {}) {
  const stop = Date.now() + ms;
  const phase = opts.phase || 'drawing';
  let k = bot.__strokeSeq || 0;
  bot.__strokeSeq = k;
  const tick = async () => {
    if (Date.now() >= stop || bot.phase !== phase) return false;
    const id = `${bot.name}-s${k}`;
    k += 1;
    bot.__strokeSeq = k;
    bot.send({ type: 'draw_begin', stroke: { id, color: opts.color || '#111827', size: 0.006, tool: opts.tool || 'pen', x: Math.random(), y: Math.random() } });
    for (let j = 0; j < 4; j += 1) {
      if (bot.phase !== phase) break;
      bot.send({ type: 'draw_points', strokeId: id, points: [[Math.random(), Math.random()], [Math.random(), Math.random()]] });
      await sleep(25);
    }
    bot.send({ type: 'draw_end', strokeId: id });
    return true;
  };
  return (async () => { while (await tick()) { await sleep(15); } })();
}
