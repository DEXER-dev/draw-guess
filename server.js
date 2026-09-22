import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';
import { WORD_BANK, WORD_ALIASES } from './words.js';
import { getWordPackCatalog, getWordPackRegistry, startWordPackWatcher } from './word-packs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 6;
const PREPARE_MS = 3000;
const WORD_CHOOSE_MS = 10000;
const RESULT_MS = 8000;
const PERFECT_RESULT_MS = 12000;
const DRAWER_PAUSE_MS = 20000;
const ROOM_EMPTY_TTL = 10 * 60 * 1000;
const ROOM_MAX_IDLE = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 200;
const MAX_EVENTS = 20000;
const MAX_RELAY_EVENTS = 8000;
const MAX_NICKNAME = 12;
const MAX_CHAT = 200;
const MAX_THUMBNAIL_CHARS = 350000;
const DATA_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/;
// 同一玩家、同一类拒绝在窗口内只回一次，否则画手跨过回合切换时每个画笔包都会弹一条 toast。
const REJECT_THROTTLE_MS = 1500;
const PEN_SKIN_IDS = new Set([
  'classic-pencil',
  'crayon-pop',
  'rainbow-marker',
  'pixel-arcade',
  'ink-brush',
  'starry-doodle',
  'crystal-turret',
  'windblade',
  'mushroom-scout',
  'coke-refresh',
  'paimon-starlight',
  'pikachu-thunderbolt',
  'miku-future-echo',
  'teto-crimson-chorus',
  'persona3-blue-hour',
  'voxel-overworld',
  'burger-buddy',
  'dragon-ink',
  'infinity-edge',
  'fire-kylin',
  'bocchi-lonely-rock',
  'kuuga-mighty-legacy',
  'whale-maid-tide',
  'luo-tianyi-resonance',
  'milk-tea',
  'snowking-frost',
  'eva-unit01',
  'wuju-master',
  'dongqin-sea-breeze',
]);
const PEN_LEGENDARY_SKIN_IDS = new Set([
  'paimon-starlight',
  'pikachu-thunderbolt',
  'miku-future-echo',
  'teto-crimson-chorus',
  'voxel-overworld',
  'dragon-ink',
  'infinity-edge',
  'fire-kylin',
  'eva-unit01',
  'persona3-blue-hour',
  'bocchi-lonely-rock',
  'kuuga-mighty-legacy',
  'whale-maid-tide',
  'luo-tianyi-resonance',
]);
const PEN_LEGENDARY_ANNOUNCE_COOLDOWN_MS = 5000;
const PEN_GACHA_GRANT_MAX = 20;
const PEN_GACHA_GRANT_COOLDOWN_MS = 700;
const MEME_PACK_IDS = new Set([
  'impact-boom-01',
  'deadpan-drop-01',
  'party-horn-01',
  'fail-buzzer-01',
  'surprise-rise-01',
  'victory-fanfare-01',
  'emotional-damage-02',
  'bonk-doge-02',
  'coffin-dance-02',
  'gta-wasted-02',
  'fbi-open-up-02',
  'sad-violin-02',
  'among-us-emergency-03',
  'why-running-03',
  'cut-g-03',
  'trololo-03',
  'its-corn-03',
  'happy-happy-03',
  'few-moments-later-04',
  'hello-there-04',
  'john-cena-04',
  'mario-falling-04',
  'just-kidding-04',
  'turtles-04',
  'crab-rave-05',
  'crazy-frog-05',
  'badum-tss-05',
  'hog-rider-05',
  'goofy-yell-05',
  'kirby-falls-05',
]);
const MEME_PACK_COOLDOWN_MS = 1400;

// 音乐点歌：B 站 BV 号下载缓存。发布版安装在 Program Files 等只读目录时，
// 缓存必须放到用户可写目录；开发环境未设置时仍保持原来的项目内 cache 行为。
const APP_DATA_DIR = path.resolve(process.env.DRAW_GUESS_DATA_DIR || path.join(__dirname, 'cache'));
const MUSIC_CACHE_DIR = path.join(APP_DATA_DIR, 'music');
const MUSIC_CACHE_MAX_BYTES = Number(process.env.MUSIC_CACHE_MAX_MB || 2048) * 1024 * 1024;
const BILI_MAX_DURATION = Number(process.env.BILI_MAX_DURATION || 600);
const BILI_DOWNLOAD_TIMEOUT_MS = Number(process.env.BILI_DOWNLOAD_TIMEOUT || 120000);
const BILI_API_TIMEOUT_MS = Number(process.env.BILI_API_TIMEOUT || 15000);
const BILI_COOKIE = String(process.env.BILI_COOKIE || '').trim();
const BILI_COOKIE_FILE = String(process.env.BILI_COOKIE_FILE || '').trim();
const BILI_PROXY = String(process.env.BILI_PROXY || '').trim();
const BILI_USER_AGENT = String(process.env.BILI_USER_AGENT || 'Mozilla/5.0').trim();
const MUSIC_MAX_QUEUE = 20;
const MUSIC_GD_MUSIC_ENABLED = String(process.env.MUSIC_GD_MUSIC_ENABLED ?? '1') === '1';
const MUSIC_GD_MUSIC_BASE = (process.env.MUSIC_GD_MUSIC_BASE || 'https://music-api.gdstudio.xyz').replace(/\/$/, '');
const MUSIC_API_TIMEOUT_MS = Number(process.env.MUSIC_API_TIMEOUT || 25000);
const FFMPEG_LOCATION = process.env.FFMPEG_PATH || process.env.FFMPEG_DIR || '';
const execFileAsync = promisify(execFile);

function resolveExecutableInPath(name) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      try {
        const candidate = path.join(dir, `${name}${ext}`);
        if (existsSync(candidate)) return candidate;
      } catch {
        // 忽略不可访问的 PATH 目录
      }
    }
  }
  return '';
}

function resolveFfmpegPath() {
  if (FFMPEG_LOCATION) {
    const candidate = path.join(FFMPEG_LOCATION, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // 继续探测
    }
  }
  const inPath = resolveExecutableInPath('ffmpeg');
  if (inPath) return inPath;
  // 常见安装位置：static_ffmpeg / scoop / winget
  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [];
  if (localAppData) candidates.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links', exe));
  if (userProfile) candidates.push(path.join(userProfile, 'scoop', 'apps', 'ffmpeg', 'current', 'bin', exe));
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    const m = /Python[^\\/]*[\\/]Scripts$/i.exec(dir);
    if (!m) continue;
    const pythonRoot = path.dirname(dir);
    const rel = process.platform === 'win32'
      ? ['Lib', 'site-packages', 'static_ffmpeg', 'bin', 'win32', exe]
      : ['lib', 'python3', 'site-packages', 'static_ffmpeg', 'bin', exe];
    candidates.push(path.join(pythonRoot, ...rel));
  }
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // 继续
    }
  }
  return 'ffmpeg'; // 最后交给系统 PATH 解析
}

function resolveFfprobePath() {
  const ffmpeg = resolveFfmpegPath();
  if (ffmpeg && ffmpeg !== 'ffmpeg') {
    const dir = path.dirname(ffmpeg);
    const probe = path.join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    try {
      if (existsSync(probe)) return probe;
    } catch {
      // 继续
    }
  }
  const inPath = resolveExecutableInPath('ffprobe');
  if (inPath) return inPath;
  return 'ffprobe';
}

const rooms = new Map();
const roomsByCode = new Map();
const musicCache = new Map(); // bvid -> { bvid, path, size, lastUsed, title, uploader, duration, thumbnail }

loadMusicCache();

function genId() {
  return crypto.randomBytes(12).toString('hex');
}

function makeCode() {
  let code = '';
  do {
    code = '';
    const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
    }
  } while (roomsByCode.has(code));
  return code;
}

function cleanNickname(raw) {
  const cleaned = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NICKNAME);
  if (cleaned) return cleaned;
  return `玩家${Math.floor(100 + Math.random() * 900)}`;
}

function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_'".!?，。！？、：:；;·]+/g, '');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function wordMatch(word, guess, extraAliases = []) {
  const answer = normalizeAnswer(word);
  const g = normalizeAnswer(guess);
  if (!answer || !g) return false;
  if (answer === g) return true;

  const aliases = [...(WORD_ALIASES[word] || []), ...(Array.isArray(extraAliases) ? extraAliases : [])];
  if (aliases.some((alias) => normalizeAnswer(alias) === g)) return true;

  // 英文单词：允许常见单复数差异和 1 个字母的拼写容错
  if (/^[a-z]+$/.test(answer) && /^[a-z]+$/.test(g)) {
    if (answer === `${g}s` || g === `${answer}s`) return true;
    if (answer.length >= 5 && levenshtein(answer, g) <= 1) return true;
  }
  return false;
}

function makeMask(word, revealedIndices = []) {
  const revealed = new Set(revealedIndices);
  return Array.from(word)
    .map((ch, i) => {
      if (/\s/.test(ch)) return ' ';
      if (revealed.has(i)) return ch;
      return /[\u3400-\u9fff\uf900-\ufaff]/.test(ch) ? '＿' : '_';
    })
    .join(' ');
}

function cleanRoomCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : null;
}

function cleanCustomWords(raw) {
  const lines = Array.isArray(raw)
    ? raw.map((item) => String(item || ''))
    : String(raw || '').split(String.fromCharCode(10));
  const seen = new Set();
  const words = [];

  const addWord = (word, hint) => {
    const clean = word.trim().slice(0, 20);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    words.push({ word: clean, hint: String(hint || '').trim().slice(0, 60) });
    if (words.length >= 200) return true;
    return false;
  };

  let full = false;
  for (const line of lines) {
    if (full) break;
    const text = line.trim();
    if (!text) continue;
    if (text.includes('|')) {
      const sepIndex = text.indexOf('|');
      const word = text.slice(0, sepIndex);
      const hint = text.slice(sepIndex + 1);
      if (addWord(word, hint)) full = true;
    } else {
      for (const word of text.split(/[,，、;；]+/)) {
        if (addWord(word, '')) {
          full = true;
          break;
        }
      }
    }
  }
  return words;
}

function describeWord(word) {
  const compact = String(word || '').replace(/\s/g, '');
  const count = Array.from(compact).length;
  const hasChinese = /[㐀-鿿豈-﫿]/.test(compact);
  const hasLatin = /[a-zA-Z]/.test(compact);
  const hasDigits = /\d/.test(compact);
  if (hasChinese && (hasLatin || hasDigits)) return `${count} 个字/字母`;
  if (hasChinese) return `${count} 个字`;
  if (hasLatin) return `${count} 个字母`;
  if (hasDigits) return `${count} 位数字`;
  return `${count} 个字符`;
}

function createRoom(preferredCode = null) {
  const wordPackRegistry = getWordPackRegistry();
  const wordPacks = { basic: true };
  for (const [packId, pack] of wordPackRegistry.packs) {
    wordPacks[packId] = Boolean(pack.enabledByDefault);
  }
  const room = {
    id: genId(),
    code: preferredCode || makeCode(),
    hostId: null,
    players: new Map(),
    status: 'waiting',
    phase: 'waiting',
    round: 0,
    turnInRound: 0,
    turnsPlayed: 0,
    totalTurns: 0,
    order: [],
    drawerIndex: 0,
    currentDrawerId: null,
    artworks: new Map(),
    // 同一个房间的"第几局"：客户端用它区分不同局的星尘奖励，避免第二局开始不发奖
    gameSeq: 0,
    relay: null,
    relayDrawings: new Map(),
    word: '',
    wordCategory: '',
    wordAliases: [],
    wordOptions: [],
    choosing: false,
    revealedIndices: [],
    wordCustomHint: '',
    wordClue: '',
    // 题目历史属于房间，而不是单局：重开或返回房间后仍然避免复用。
    // 题池全部耗尽时，buildWordPool() 才会自动清空并开始下一轮循环。
    usedWords: [],
    exposedWords: [],
    config: {
      rounds: 3,
      drawSeconds: 80,
      maxPlayers: 12,
      wordMode: 'choice',
      customWords: [],
      customOnly: false,
      wordPacks,
      gameMode: 'classic',
      relayPasses: 4,
      guessSeconds: 30,
    },
    events: [],
    nextSeq: 1,
    activeStrokes: new Set(),
    correctGuesserIds: [],
    correctGuessRecords: [],
    hintsShown: 0,
    paused: false,
    deadline: null,
    pauseDeadline: null,
    pauseRemaining: 0,
    resultDuration: RESULT_MS,
    phaseTimer: null,
    pauseTimer: null,
    hintTimers: [],
    skipVotes: new Set(),
    songQueue: [],
    musicCurrent: null,
    musicPlaySeq: 0,
    musicDownloads: new Map(),
    musicTimer: null,
    createdAt: Date.now(),
    // 房间创建后尚未建立 WebSocket 时也应进入空房回收计时。
    emptySince: Date.now(),
    // 词库热读取后，正在进行的对局继续使用开局时的注册表快照。
    wordPackRegistry,
  };
  return room;
}

function makePlayer(nickname) {
  return {
    id: genId(),
    token: crypto.randomBytes(24).toString('hex'),
    nickname,
    avatarHue: Math.floor(Math.random() * 360),
    penSkinId: 'classic-pencil',
    score: 0,
    isHost: false,
    online: false,
    ws: null,
    guessed: false,
    lastGuessAt: 0,
    lastChatAt: 0,
    lastDrawAt: 0,
    lastThrowAt: 0,
    lastMemePackAt: 0,
    lastRateAt: 0,
    lastPenLegendaryAt: 0,
    lastPenGachaGrantAt: 0,
    lastRejectAt: new Map(),
  };
}

function publicPlayers(room) {
  const orderIndex = new Map(room.order.map((id, index) => [id, index + 1]));
  return [...room.players.values()]
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatarHue: p.avatarHue,
      penSkinId: PEN_SKIN_IDS.has(p.penSkinId) ? p.penSkinId : 'classic-pencil',
      score: p.score,
      isHost: p.isHost,
      online: p.online,
      guessed: p.guessed,
      isDrawer: p.id === room.currentDrawerId,
      drawOrder: orderIndex.get(p.id) || 0,
    }))
    .sort((a, b) => b.score - a.score);
}

function scoreList(room) {
  return [...room.players.values()]
    .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

// ---------- 音乐点歌：缓存管理 ----------
function loadMusicCache() {
  ensureMusicCacheDir();
  for (const file of readdirSync(MUSIC_CACHE_DIR)) {
    const match = file.match(/^(BV[0-9A-Za-z]{10}|ne\d+|gd\d+)\./);
    if (!match) continue;
    const bvid = match[1];
    const filePath = path.join(MUSIC_CACHE_DIR, file);
    try {
      const size = statSync(filePath).size;
      musicCache.set(bvid, {
        bvid,
        path: filePath,
        size,
        lastUsed: Date.now(),
        title: '',
        uploader: '',
        duration: 0,
        thumbnail: '',
      });
    } catch {
      // 忽略损坏文件
    }
  }
}

function ensureMusicCacheDir() {
  mkdirSync(MUSIC_CACHE_DIR, { recursive: true });
}

function musicCacheTotalBytes() {
  let total = 0;
  for (const entry of musicCache.values()) total += entry.size || 0;
  return total;
}

function touchMusicCache(bvid) {
  const entry = musicCache.get(bvid);
  if (entry) entry.lastUsed = Date.now();
}

function pruneMusicCache() {
  ensureMusicCacheDir();
  let total = musicCacheTotalBytes();
  if (total <= MUSIC_CACHE_MAX_BYTES) return;

  const sorted = [...musicCache.values()].sort((a, b) => a.lastUsed - b.lastUsed);
  for (const entry of sorted) {
    if (total <= MUSIC_CACHE_MAX_BYTES * 0.8) break;
    try {
      unlinkSync(entry.path);
    } catch {
      // 忽略删除失败
    }
    musicCache.delete(entry.bvid);
    total -= entry.size || 0;
  }
}

function musicFileUrl(bvid) {
  return `/api/music/file/${encodeURIComponent(bvid)}`;
}

function serializeMusicQueue(room) {
  return room.songQueue.map((item) => ({
    key: item.key,
    title: item.title,
    uploader: item.uploader || '',
    duration: item.duration || 0,
    thumbnail: item.thumbnail || '',
    source: item.source || 'bilibili',
    status: item.status || 'ready',
    requestedBy: item.requestedBy || '',
    url: musicFileUrl(item.key),
    lyric: item.lyric || '',
    trial: Boolean(item.trial),
  }));
}

function serializeMusicCurrent(room) {
  if (!room.musicCurrent) return null;
  const c = room.musicCurrent;
  return {
    key: c.key,
    title: c.title,
    uploader: c.uploader || '',
    duration: c.duration || 0,
    thumbnail: c.thumbnail || '',
    source: c.source || 'bilibili',
    playId: c.playId || 0,
    requestedBy: c.requestedBy || '',
    url: c.url || '',
    lyric: c.lyric || '',
    trial: Boolean(c.trial),
  };
}

function broadcastMusicState(room) {
  broadcast(room, {
    type: 'music_state',
    queue: serializeMusicQueue(room),
    current: serializeMusicCurrent(room),
  });
}

function clearRoomMusic(room) {
  if (room.musicTimer) clearTimeout(room.musicTimer);
  room.musicTimer = null;
  room.songQueue = [];
  room.musicCurrent = null;
  room.musicDownloads = new Map();
}

function playNextSong(room) {
  if (room.musicTimer) clearTimeout(room.musicTimer);
  room.musicTimer = null;
  const index = room.songQueue.findIndex((item) => item.status === 'ready');
  if (index < 0) {
    room.musicCurrent = null;
    broadcastMusicState(room);
    return;
  }
  const item = room.songQueue.splice(index, 1)[0];
  const cached = musicCache.get(item.key);
  if (!cached || !existsSync(cached.path)) {
    room.songQueue.unshift(item);
    room.songQueue = room.songQueue.filter((x) => x.status === 'ready');
    if (room.songQueue.length === 0) {
      room.musicCurrent = null;
      broadcastMusicState(room);
    }
    return;
  }
  touchMusicCache(item.key);
  item.status = 'ready';
  item.url = musicFileUrl(item.key);
  room.musicPlaySeq += 1;
  item.playId = room.musicPlaySeq;
  room.musicCurrent = item;

  broadcast(room, {
    type: 'music_play',
    song: serializeMusicCurrent(room),
  });
  broadcastMusicState(room);
}

function isBvid(raw) {
  return typeof raw === 'string' && /^BV[0-9A-Za-z]{10}$/.test(raw.trim());
}

function validateMusicQueue(room) {
  if (room.songQueue.length >= MUSIC_MAX_QUEUE) {
    return '点歌队列已满';
  }
  return null;
}

// ---------- B 站 BV 号点歌：多源解析与下载兜底 ----------
function biliUrl(bvid) {
  return `https://www.bilibili.com/video/${bvid}`;
}

function biliAltUrl(bvid) {
  return `https://b23.tv/${bvid}`;
}

function biliRequestHeaders(bvid, json = false) {
  const headers = {
    'User-Agent': BILI_USER_AGENT,
    Referer: `${biliUrl(bvid)}/`,
  };
  if (json) headers.Accept = 'application/json, text/plain, */*';
  if (BILI_COOKIE) headers.Cookie = BILI_COOKIE;
  return headers;
}

async function biliApiGet(endpoint, params = {}, bvid = '') {
  const url = new URL(`https://api.bilibili.com${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: biliRequestHeaders(bvid, true),
    signal: AbortSignal.timeout(BILI_API_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`官方接口 HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || Number(payload.code) !== 0 || !payload.data) {
    throw new Error(payload && payload.message ? payload.message : '官方接口没有返回数据');
  }
  return payload.data;
}

function cleanBiliText(value, maxLength) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, maxLength);
}

function normalizeBiliThumbnail(value) {
  const thumbnail = String(value || '').trim();
  if (thumbnail.startsWith('//')) return `https:${thumbnail}`;
  return thumbnail;
}

function validateBiliDuration(duration) {
  const seconds = Number(duration) || 0;
  if (seconds > BILI_MAX_DURATION) {
    throw new Error(`视频时长 ${Math.round(seconds)} 秒，超过 ${BILI_MAX_DURATION} 秒限制`);
  }
  return seconds;
}

async function resolveBiliWithYtDlp(bvid) {
  try {
    const args = ['-J', '--no-playlist', '--extractor-retries', '2', '--retries', '2'];
    if (BILI_PROXY) args.push('--proxy', BILI_PROXY);
    if (BILI_COOKIE_FILE) args.push('--cookies', BILI_COOKIE_FILE);
    if (BILI_COOKIE) args.push('--add-header', `Cookie: ${BILI_COOKIE}`);
    if (BILI_USER_AGENT) args.push('--user-agent', BILI_USER_AGENT);
    args.push(biliUrl(bvid));
    const { stdout } = await execFileAsync(
      'yt-dlp',
      args,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    let info;
    try {
      info = JSON.parse(stdout);
    } catch {
      throw new Error('yt-dlp 返回了无法解析的数据');
    }
    if (!info || !info.title) throw new Error('未找到该视频');
    const duration = validateBiliDuration(info.duration);
    const result = {
      title: cleanBiliText(info.title, 80),
      uploader: cleanBiliText(info.uploader || info.uploader_id || '', 40),
      duration,
      thumbnail: normalizeBiliThumbnail(info.thumbnail),
      resolvedBy: 'yt-dlp',
    };
    const existing = musicCache.get(bvid);
    if (existing) {
      musicCache.set(bvid, { ...existing, ...result });
    }
    return result;
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'EPERM')) {
      throw new Error('服务器未安装 yt-dlp 或禁止执行，请先安装后再点歌');
    }
    const message = (err && err.message) ? err.message : String(err);
    throw new Error(message);
  }
}

async function resolveBiliWithOfficialApi(bvid) {
  const data = await biliApiGet('/x/web-interface/view', { bvid }, bvid);
  if (!data.title) throw new Error('官方接口未找到该视频');
  const page = Array.isArray(data.pages) ? data.pages[0] : null;
  return {
    title: cleanBiliText(data.title, 80),
    uploader: cleanBiliText(data.owner && data.owner.name, 40),
    duration: validateBiliDuration(data.duration || (page && page.duration)),
    thumbnail: normalizeBiliThumbnail(data.pic),
    resolvedBy: 'bilibili-api',
  };
}

async function resolveBiliInfo(bvid) {
  const errors = [];
  try {
    return await resolveBiliWithOfficialApi(bvid);
  } catch (err) {
    errors.push(`官方接口：${err.message || err}`);
  }
  try {
    return await resolveBiliWithYtDlp(bvid);
  } catch (err) {
    errors.push(`yt-dlp：${err.message || err}`);
  }
  throw new Error(`解析失败（已尝试 ${errors.length} 个源）：${errors.join('；')}`);
}

function biliAudioFilePath(bvid) {
  return path.join(MUSIC_CACHE_DIR, `${bvid}.mp3`);
}

function findBiliAudioFile(bvid) {
  const audioExts = new Set(['.mp3', '.m4a', '.webm', '.opus', '.aac', '.mp4', '.flac']);
  const fileName = readdirSync(MUSIC_CACHE_DIR).find((file) => {
    return file.startsWith(`${bvid}.`) && audioExts.has(path.extname(file).toLowerCase());
  });
  return fileName ? path.join(MUSIC_CACHE_DIR, fileName) : null;
}

function cacheBiliAudio(bvid, info, filePath) {
  const size = statSync(filePath).size;
  musicCache.set(bvid, {
    bvid,
    path: filePath,
    size,
    lastUsed: Date.now(),
    title: info.title,
    uploader: info.uploader,
    duration: info.duration,
    thumbnail: info.thumbnail,
  });
  pruneMusicCache();
  return filePath;
}

function ytDlpBiliArgs(output, videoUrl, fallback = false) {
  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '5',
    '--no-playlist',
    '--no-progress',
    '--force-overwrites',
    '--retries', '3',
    '--fragment-retries', '3',
  ];
  if (fallback) {
    args.push('--force-ipv4', '--referer', `${biliUrl(videoUrl.match(/BV[0-9A-Za-z]{10}/)?.[0] || '')}/`);
  }
  if (FFMPEG_LOCATION) args.push('--ffmpeg-location', FFMPEG_LOCATION);
  if (BILI_PROXY) args.push('--proxy', BILI_PROXY);
  if (BILI_COOKIE_FILE) args.push('--cookies', BILI_COOKIE_FILE);
  if (BILI_COOKIE) args.push('--add-header', `Cookie: ${BILI_COOKIE}`);
  if (BILI_USER_AGENT) args.push('--user-agent', BILI_USER_AGENT);
  args.push('-o', output, videoUrl);
  return args;
}

async function downloadBiliWithYtDlp(bvid, info, videoUrl, fallback = false) {
  ensureMusicCacheDir();
  const output = path.join(MUSIC_CACHE_DIR, `${bvid}.%(ext)s`);
  try {
    await execFileAsync(
      'yt-dlp',
      ytDlpBiliArgs(output, videoUrl, fallback),
      { timeout: BILI_DOWNLOAD_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'EPERM')) {
      throw new Error('服务器未安装 yt-dlp 或禁止执行');
    }
    const message = (err && err.message) ? err.message : String(err);
    throw new Error(message);
  }
  const filePath = findBiliAudioFile(bvid);
  if (!filePath) throw new Error('yt-dlp 完成但未找到音频文件');
  return cacheBiliAudio(bvid, info, filePath);
}

function pickBiliStreamUrl(playData) {
  const audio = Array.isArray(playData && playData.dash && playData.dash.audio)
    ? [...playData.dash.audio].sort((a, b) => Number(b.bandwidth || 0) - Number(a.bandwidth || 0))[0]
    : null;
  const durl = Array.isArray(playData && playData.durl) ? playData.durl[0] : null;
  const candidate = audio || durl;
  if (!candidate) return '';
  return String(
    candidate.baseUrl
      || candidate.base_url
      || candidate.url
      || (Array.isArray(candidate.backupUrl) && candidate.backupUrl[0])
      || (Array.isArray(candidate.backup_url) && candidate.backup_url[0])
      || ''
  );
}

async function downloadBiliWithOfficialApi(bvid, info) {
  ensureMusicCacheDir();
  const view = await biliApiGet('/x/web-interface/view', { bvid }, bvid);
  const page = Array.isArray(view.pages) ? view.pages[0] : null;
  const cid = page && page.cid ? page.cid : view.cid;
  if (!cid) throw new Error('官方接口没有找到视频分 P');
  const playData = await biliApiGet('/x/player/playurl', {
    bvid,
    cid,
    fnval: 16,
    fnver: 0,
    fourk: 1,
  }, bvid);
  const streamUrl = pickBiliStreamUrl(playData);
  if (!streamUrl) throw new Error('官方接口没有返回可播放音频流');

  const response = await fetch(streamUrl, {
    headers: biliRequestHeaders(bvid),
    signal: AbortSignal.timeout(BILI_DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`官方音频流 HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  const hasDash = Array.isArray(playData && playData.dash && playData.dash.audio);
  let streamExt = hasDash ? 'm4a' : 'mp4';
  if (/m4a|aac/i.test(contentType)) streamExt = 'm4a';
  else if (/mp4/i.test(contentType)) streamExt = 'mp4';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('官方音频流为空');

  const sourcePath = path.join(MUSIC_CACHE_DIR, `${bvid}.source`);
  const outputPath = biliAudioFilePath(bvid);
  const rawPath = path.join(MUSIC_CACHE_DIR, `${bvid}.${streamExt}`);
  await writeFile(sourcePath, buffer);

  let converted = false;
  try {
    const ffmpeg = resolveFfmpegPath();
    if (ffmpeg) {
      await execFileAsync(
        ffmpeg,
        ['-y', '-i', sourcePath, '-vn', '-codec:a', 'libmp3lame', '-q:a', '5', outputPath],
        { timeout: BILI_DOWNLOAD_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
      );
      if (existsSync(outputPath)) converted = true;
    }
  } catch {
    // ffmpeg 不可用或转码失败时，直接保留官方音频流
  } finally {
    try { unlinkSync(sourcePath); } catch { /* ignore */ }
  }

  if (converted) return cacheBiliAudio(bvid, info, outputPath);
  await writeFile(rawPath, buffer);
  return cacheBiliAudio(bvid, info, rawPath);
}

async function downloadBiliAudio(bvid, info) {
  const attempts = [
    ['B站官方播放流', () => downloadBiliWithOfficialApi(bvid, info)],
    ['yt-dlp 主链路', () => downloadBiliWithYtDlp(bvid, info, biliUrl(bvid))],
    ['B23 短链 + IPv4 重试', () => downloadBiliWithYtDlp(bvid, info, biliAltUrl(bvid), true)],
  ];
  const errors = [];
  for (const [label, attempt] of attempts) {
    try {
      return await attempt();
    } catch (err) {
      errors.push(`${label}：${err.message || err}`);
    }
  }
  throw new Error(`下载失败（已尝试 ${attempts.length} 个方案）：${errors.join('；')}`);
}

function queueBiliSong(room, player, bvid, info) {
  const queueError = validateMusicQueue(room);
  if (queueError) {
    sendJson(player.ws, { type: 'music_error', message: queueError });
    return;
  }
  const exists = room.songQueue.some((x) => x.key === bvid) || (room.musicCurrent && room.musicCurrent.key === bvid);
  if (exists) {
    sendJson(player.ws, { type: 'music_error', message: '这首歌已经在队列里了' });
    return;
  }
  const item = {
    key: bvid,
    title: info.title,
    uploader: info.uploader || '',
    duration: info.duration || 0,
    thumbnail: info.thumbnail || '',
    source: 'bilibili',
    status: 'ready',
    requestedBy: player.nickname,
    requestedById: player.id,
  };
  room.songQueue.push(item);
  broadcastMusicState(room);
  if (!room.musicCurrent) playNextSong(room);
}

async function handleBiliResolve(room, player, msg) {
  const bvid = String(msg.bvid || '').trim();
  if (!isBvid(bvid)) {
    sendJson(player.ws, { type: 'music_error', message: 'BV 号格式不正确，示例：BV1xx411c7mD' });
    return;
  }
  try {
    const info = await resolveBiliInfo(bvid);
    const cached = musicCache.get(bvid);
    sendJson(player.ws, {
      type: 'music_bili_resolved',
      bvid,
      info,
      ready: Boolean(cached && existsSync(cached.path)),
    });
  } catch (err) {
    sendJson(player.ws, { type: 'music_error', message: err.message || '解析失败' });
  }
}

async function handleBiliRequest(room, player, msg) {
  const bvid = String(msg.bvid || '').trim();
  if (!isBvid(bvid)) {
    sendJson(player.ws, { type: 'music_error', message: 'BV 号格式不正确' });
    return;
  }
  if (room.musicDownloads.has(bvid)) {
    sendJson(player.ws, { type: 'music_error', message: '这首歌正在下载中，请稍候' });
    return;
  }

  const cached = musicCache.get(bvid);
  if (cached && existsSync(cached.path)) {
    let info = cached;
    if (!info.title) {
      try {
        info = await resolveBiliInfo(bvid);
      } catch {
        // 元数据解析失败时仍用缓存文件播放，标题退化为 BV 号
      }
    }
    queueBiliSong(room, player, bvid, info);
    return;
  }

  room.musicDownloads.set(bvid, true);
  sendJson(player.ws, { type: 'music_download_start', bvid, message: '开始下载，请稍候…' });
  try {
    const info = await resolveBiliInfo(bvid);
    await downloadBiliAudio(bvid, info);
    queueBiliSong(room, player, bvid, info);
  } catch (err) {
    sendJson(player.ws, { type: 'music_error', message: err.message || '点歌失败' });
  } finally {
    room.musicDownloads.delete(bvid);
  }
}

// ---------- GD音乐台：独立 API 解析源（含歌词） ----------
function gdKey(songId) {
  return `gd${songId}`;
}

function audioTrialReason(meta, expectedSec, actualSec, fileBytes = 0) {
  if (!meta) return '';
  if (meta.freeTrialInfo && meta.freeTrialInfo !== 'null') return '接口标记为试听片段';
  if (expectedSec > 30 && actualSec != null && actualSec < Math.min(60, expectedSec * 0.55)) {
    return `实际时长 ${actualSec.toFixed(1)}s 不足完整播放`;
  }
  if (expectedSec > 30) {
    const reportedTime = Number(meta.time) || 0;
    const reportedSec = reportedTime > 0 && reportedTime < 1000 ? reportedTime : reportedTime / 1000;
    if (reportedSec > 0 && reportedSec < Math.min(60, expectedSec * 0.55)) {
      return '接口返回的时长不足完整播放';
    }
    const size = Number(meta.size) || fileBytes || 0;
    const br = Number(meta.br) || 128000;
    if (size > 0) {
      const expectedBytes = (expectedSec * br) / 8;
      if (size < expectedBytes * 0.55) {
        return `文件大小 ${(size / 1024 / 1024).toFixed(1)}MB 不足完整播放`;
      }
    }
  }
  return '';
}

async function gdFetchJson(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const url = `${MUSIC_GD_MUSIC_BASE}/api.php?${query.toString()}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(MUSIC_API_TIMEOUT_MS),
    headers: { 'user-agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`GD音乐台请求失败（HTTP ${res.status}）`);
  return res.json();
}

async function resolveGdMusicUrl(songId, { br = 320, source = 'netease' } = {}) {
  const data = await gdFetchJson({ types: 'url', source, id: songId, br });
  if (!data || !data.url) throw new Error('GD音乐台未返回可用地址');
  return {
    url: data.url,
    meta: {
      size: Number(data.size) || 0,
      br: Number(data.br) || 0,
      source: 'gdmusic',
    },
  };
}

async function resolveGdMusicLyric(lyricId) {
  const data = await gdFetchJson({ types: 'lyric', source: 'netease', id: lyricId });
  const lrc = data && (data.lyric || data.tlyric);
  return typeof lrc === 'string' ? lrc.slice(0, 20000) : '';
}

async function probeAudioDuration(filePath) {
  const candidates = [];
  const found = resolveFfprobePath();
  if (found) candidates.push(found);
  if (FFMPEG_LOCATION) {
    candidates.push(path.join(FFMPEG_LOCATION, 'ffprobe.exe'), path.join(FFMPEG_LOCATION, 'ffprobe'));
  }
  candidates.push('ffprobe');
  for (const cmd of [...new Set(candidates)]) {
    try {
      const { stdout } = await execFileAsync(
        cmd,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
        { timeout: 15000, maxBuffer: 1024 * 1024 }
      );
      const value = parseFloat(String(stdout).trim());
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
      // 尝试下一个 ffprobe 路径
    }
  }
  return null;
}

function estimateAudioSeconds(bytes, br) {
  const bitrate = Number(br) > 0 ? Number(br) : 128000;
  return bytes * 8 / bitrate;
}

async function fetchRemoteAudio(songId, info, audioUrl, meta = {}, options = {}) {
  ensureMusicCacheDir();
  const key = options.cacheKey || gdKey(songId);
  const headers = options.headers || {};
  const res = await fetch(audioUrl, { headers, signal: AbortSignal.timeout(MUSIC_API_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`音频下载失败（HTTP ${res.status}）`);
  const contentType = res.headers.get('content-type') || '';
  const isM4a = /m4a|mp4|aac/i.test(contentType) || /\.m4a(?:$|\?)/i.test(audioUrl);
  const ext = isM4a ? 'm4a' : 'mp3';
  const buf = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(MUSIC_CACHE_DIR, `${key}.${ext}`);
  await writeFile(filePath, buf);
  const actualDuration = await probeAudioDuration(filePath);
  const trialReason = audioTrialReason(meta, Number(info.duration) || 0, actualDuration, buf.length);
  return {
    filePath,
    buf,
    actualDuration,
    isTrial: Boolean(trialReason),
    trialReason,
    trialSeconds: trialReason && !actualDuration
      ? estimateAudioSeconds(buf.length, Number(meta && meta.br) || 0)
      : actualDuration,
  };
}

// ---------- GD音乐台：独立 API 解析源（含歌词） ----------
async function searchGdMusic(q) {
  const data = await gdFetchJson({ types: 'search', source: 'netease', name: q, count: 10 });
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.data)) ? data.data : [];
  return list.map((song) => {
    const artist = Array.isArray(song.artist)
      ? song.artist.filter(Boolean).join(' / ')
      : String(song.artist || '');
    let duration = Math.round(Number(song.duration || 0) / 1000);
    if (!Number.isFinite(duration) || duration < 0) duration = 0;
    return {
      id: String(song.id || ''),
      title: String(song.name || song.title || '').slice(0, 80),
      artist: artist.slice(0, 80),
      album: String(song.album || '').slice(0, 60),
      cover: '',
      duration,
      urlId: String(song.url_id || song.id || ''),
      lyricId: String(song.lyric_id || song.id || ''),
    };
  }).filter((song) => song.id && (song.urlId || song.lyricId));
}

async function downloadGdAudio(songId, info) {
  ensureMusicCacheDir();
  const key = gdKey(songId);
  const item = await resolveGdMusicUrl(info.urlId || songId);
  const result = await fetchRemoteAudio(songId, info, item.url, item.meta, {
    cacheKey: key,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: `${MUSIC_GD_MUSIC_BASE}/`,
    },
  });
  const duration = result.actualDuration || Number(info.duration) || 0;
  musicCache.set(key, {
    bvid: key,
    path: result.filePath,
    size: result.buf.length,
    lastUsed: Date.now(),
    title: info.title,
    uploader: info.artist || '',
    duration,
    thumbnail: info.cover || '',
    lyric: info.lyric || '',
    trial: false,
    source: 'gdmusic',
  });
  pruneMusicCache();
}

function queueGdSong(room, player, songId, info) {
  const key = gdKey(songId);
  const queueError = validateMusicQueue(room);
  if (queueError) {
    sendJson(player.ws, { type: 'music_error', message: queueError });
    return;
  }
  const exists = room.songQueue.some((x) => x.key === key) || (room.musicCurrent && room.musicCurrent.key === key);
  if (exists) {
    sendJson(player.ws, { type: 'music_error', message: '这首歌已经在队列里了' });
    return;
  }
  const cached = musicCache.get(key);
  const item = {
    key,
    title: String(info.title || (cached && cached.title) || '未知歌曲').slice(0, 80),
    uploader: String(info.artist || (cached && cached.uploader) || '').slice(0, 40),
    duration: (cached && cached.duration) || Number(info.duration) || 0,
    thumbnail: info.cover || (cached && cached.thumbnail) || '',
    source: 'gdmusic',
    status: 'ready',
    requestedBy: player.nickname,
    requestedById: player.id,
    lyric: info.lyric || (cached && cached.lyric) || '',
    trial: false,
  };
  room.songQueue.push(item);
  broadcastMusicState(room);
  if (!room.musicCurrent) playNextSong(room);
}

async function handleGdSearch(room, player, msg) {
  if (!MUSIC_GD_MUSIC_ENABLED) {
    sendJson(player.ws, { type: 'music_error', message: 'GD音乐台未启用' });
    return;
  }
  const q = String(msg.q || '').trim();
  if (!q) {
    sendJson(player.ws, { type: 'music_error', message: '请输入搜索关键词' });
    return;
  }
  try {
    const results = await searchGdMusic(q);
    sendJson(player.ws, { type: 'music_gd_results', results });
  } catch (err) {
    sendJson(player.ws, { type: 'music_error', message: err.message || 'GD音乐台搜索失败' });
  }
}

async function handleGdRequest(room, player, msg) {
  if (!MUSIC_GD_MUSIC_ENABLED) {
    sendJson(player.ws, { type: 'music_error', message: 'GD音乐台未启用' });
    return;
  }
  const songId = String(msg.songId || '').trim();
  if (!/^\d+$/.test(songId)) {
    sendJson(player.ws, { type: 'music_error', message: '歌曲 ID 不正确' });
    return;
  }
  const key = gdKey(songId);
  const urlId = /^\d+$/.test(String(msg.urlId || '')) ? String(msg.urlId) : songId;
  const lyricId = /^\d+$/.test(String(msg.lyricId || '')) ? String(msg.lyricId) : songId;
  const queueError = validateMusicQueue(room);
  if (queueError) {
    sendJson(player.ws, { type: 'music_error', message: queueError });
    return;
  }
  if (room.musicDownloads.has(key)) {
    sendJson(player.ws, { type: 'music_error', message: '这首歌正在下载中，请稍候' });
    return;
  }
  const info = {
    title: String(msg.title || '未知歌曲').slice(0, 80),
    artist: String(msg.artist || '').slice(0, 40),
    duration: Number(msg.duration) || 0,
    cover: msg.cover || '',
    urlId,
    lyricId,
    lyric: '',
  };

  const cached = musicCache.get(key);
  if (cached && existsSync(cached.path)) {
    let lyric = cached.lyric || '';
    if (!lyric) {
      try {
        lyric = await resolveGdMusicLyric(lyricId);
        cached.lyric = lyric;
      } catch {
        // 没有歌词不阻塞点歌
      }
    }
    queueGdSong(room, player, songId, {
      ...info,
      lyric,
      title: cached.title || info.title,
      artist: cached.uploader || info.artist,
      duration: cached.duration || info.duration,
      cover: cached.thumbnail || info.cover,
    });
    return;
  }

  room.musicDownloads.set(key, true);
  sendJson(player.ws, { type: 'music_download_start', songId, message: '开始下载，请稍候…' });
  try {
    await downloadGdAudio(songId, info);
    let lyric = '';
    try {
      lyric = await resolveGdMusicLyric(lyricId);
      const cacheEntry = musicCache.get(key);
      if (cacheEntry) cacheEntry.lyric = lyric;
    } catch {
      // 没有歌词不阻塞点歌
    }
    info.lyric = lyric;
    queueGdSong(room, player, songId, info);
  } catch (err) {
    sendJson(player.ws, { type: 'music_error', message: err.message || '点歌失败' });
  } finally {
    room.musicDownloads.delete(key);
  }
}

function handleMusicSkip(room, player) {
  // 播放控制已经改为设备本地操作，保留旧消息入口以兼容旧客户端。
  sendJson(player.ws, { type: 'music_error', message: '切歌只影响当前设备，请在本机音乐面板操作' });
}

function handleMusicStop(room, player) {
  // 播放控制已经改为设备本地操作，保留旧消息入口以兼容旧客户端。
  sendJson(player.ws, { type: 'music_error', message: '停止只影响当前设备，请在本机音乐面板操作' });
}

function handleMusicFinished(room, player, msg) {
  const key = String(msg.key || '').trim();
  const playId = Number(msg.playId) || 0;
  const current = room.musicCurrent;
  if (!key || !current || current.key !== key) return;
  // 新客户端携带播放序号，避免旧设备延迟上报时误消费后来重新点入的同一首歌。
  if (playId && current.playId && playId !== current.playId) return;
  playNextSong(room);
}

function handleSkipVote(room, player) {
  if (room.phase !== 'result') return;
  if (room.skipVotes.has(player.id)) room.skipVotes.delete(player.id);
  else room.skipVotes.add(player.id);

  const votes = skipVoteCount(room);
  const required = skipVoteRequired(room);
  if (votes >= required) {
    advanceAfterResult(room);
    return;
  }
  sendSkipVoteState(room);
}

function handlePenLegendaryAnnounce(room, player, msg) {
  const skinId = String(msg.skinId || '').trim();
  if (!PEN_LEGENDARY_SKIN_IDS.has(skinId)) return;
  const now = Date.now();
  if (now - player.lastPenLegendaryAt < PEN_LEGENDARY_ANNOUNCE_COOLDOWN_MS) return;
  player.lastPenLegendaryAt = now;
  const announceId = String(msg.announceId || '').trim().slice(0, 100) || crypto.randomUUID();
  // 抽卡本身仍是客户端本地收藏逻辑；服务端只校验传说 ID、限频并转发轻量庆祝事件。
  broadcast(room, {
    type: 'pen_legendary_announce',
    announceId,
    playerId: player.id,
    nickname: player.nickname,
    skinId,
  });
}

function isLocalTestOrigin(ws) {
  const origin = String(ws?._origin || '').trim();
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function handlePenGachaGrant(room, player, ws, msg) {
  if (!isLocalTestOrigin(ws)) {
    sendJson(ws, { type: 'error', code: 'pen_gacha_grant_forbidden', message: '只有 localhost 用户可以发放抽数' });
    return;
  }
  if (room.phase === 'waiting' || room.phase === 'finished') {
    sendJson(ws, { type: 'error', code: 'pen_gacha_grant_bad_phase', message: '请在游戏进行中发放抽数' });
    return;
  }
  const amount = Math.floor(Number(msg.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > PEN_GACHA_GRANT_MAX) {
    sendJson(ws, { type: 'error', code: 'pen_gacha_grant_bad_amount', message: `一次只能发放 1-${PEN_GACHA_GRANT_MAX} 抽` });
    return;
  }
  const now = Date.now();
  if (now - player.lastPenGachaGrantAt < PEN_GACHA_GRANT_COOLDOWN_MS) return;
  player.lastPenGachaGrantAt = now;
  const recipientCount = [...room.players.values()]
    .filter((p) => p.online && p.ws && p.ws.readyState === WebSocket.OPEN)
    .length;
  // 抽数只通过当前房间的轻量事件发放，客户端各自保存到本机收藏数据中。
  broadcast(room, {
    type: 'pen_gacha_grant',
    senderId: player.id,
    senderNickname: player.nickname,
    amount,
    recipientCount,
  });
}

function sendJson(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ serverTime: Date.now(), ...obj }));
  }
}

function sendReject(player, code, message) {
  const now = Date.now();
  const last = player.lastRejectAt.get(code) || 0;
  if (now - last < REJECT_THROTTLE_MS) return;
  player.lastRejectAt.set(code, now);
  sendJson(player.ws, { type: 'error', code, message });
}

function broadcast(room, obj, exceptId = null) {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify({ serverTime: Date.now(), ...obj }));
    }
  }
}

function sendToPlayer(room, playerId, obj) {
  const player = room.players.get(playerId);
  if (player) sendJson(player.ws, obj);
}

function systemChat(room, text) {
  broadcast(room, { type: 'chat', system: true, text, ts: Date.now() });
}

function broadcastPlayers(room) {
  broadcast(room, { type: 'players', players: publicPlayers(room) });
}

function skipVoteRequired(room) {
  const onlineCount = [...room.players.values()].filter((player) => player.online).length;
  return Math.max(1, Math.floor(onlineCount / 2) + 1);
}

function skipVoteCount(room) {
  const onlineIds = new Set([...room.players.values()]
    .filter((player) => player.online)
    .map((player) => player.id));
  return [...room.skipVotes].filter((id) => onlineIds.has(id)).length;
}

function sendSkipVoteState(room) {
  const votes = skipVoteCount(room);
  const required = skipVoteRequired(room);
  for (const player of room.players.values()) {
    if (!player.online) continue;
    sendJson(player.ws, {
      type: 'skip_vote_state',
      votes,
      required,
      voted: room.skipVotes.has(player.id),
    });
  }
}

function clearRoomTimers(room) {
  if (room.phaseTimer) clearTimeout(room.phaseTimer);
  if (room.pauseTimer) clearTimeout(room.pauseTimer);
  for (const timer of room.hintTimers) clearTimeout(timer);
  room.phaseTimer = null;
  room.pauseTimer = null;
  room.hintTimers = [];
}

function phaseChanged(room, extra = {}) {
  const obj = {
    type: 'phase_changed',
    phase: room.phase,
    round: room.round,
    totalRounds: room.config.rounds,
    turnInRound: room.turnInRound,
    playersPerRound: room.order.length,
    totalTurns: room.totalTurns,
    drawerId: room.currentDrawerId,
    deadline: room.deadline,
    paused: room.paused,
    pauseDeadline: room.pauseDeadline,
    category: room.wordCategory,
    choosing: Boolean(room.choosing),
    wordMasked: room.phase === 'drawing' || room.phase === 'prepare'
      ? makeMask(room.word)
      : room.phase === 'result'
        ? room.word
        : '',
    wordDescription: room.word ? describeWord(room.word) : '',
    ...extra,
  };
  broadcast(room, obj);
}

function roomStateFor(room, player) {
  return {
    type: 'room_state',
    room: {
      code: room.code,
      phase: room.phase,
      status: room.status,
      round: room.round,
      totalRounds: room.config.rounds,
      turnInRound: room.turnInRound,
      playersPerRound: room.order.length,
      totalTurns: room.totalTurns,
      drawSeconds: room.config.drawSeconds,
      maxPlayers: room.config.maxPlayers,
      wordMode: room.config.wordMode,
      customWords: player.isHost ? [...(room.config.customWords || [])] : [],
      customWordCount: (room.config.customWords || []).length,
      customOnly: Boolean(room.config.customOnly),
      wordPacks: { ...(room.config.wordPacks || {}) },
      gameMode: room.config.gameMode,
      relayPasses: room.config.relayPasses,
      guessSeconds: room.config.guessSeconds,
      hostId: room.hostId,
      gameSeq: room.gameSeq,
    },
    you: {
      id: player.id,
      nickname: player.nickname,
      isHost: player.isHost,
      score: player.score,
      guessed: player.guessed,
      penSkinId: PEN_SKIN_IDS.has(player.penSkinId) ? player.penSkinId : 'classic-pencil',
    },
    drawerId: room.currentDrawerId,
    phase: room.phase,
    deadline: room.deadline,
    paused: room.paused,
    pauseDeadline: room.pauseDeadline,
    category: room.wordCategory,
    choosing: Boolean(room.choosing),
    wordMasked: room.phase === 'drawing' || room.phase === 'prepare'
      ? makeMask(room.word)
      : room.phase === 'result'
        ? room.word
        : '',
    wordDescription: room.word ? describeWord(room.word) : '',
    players: publicPlayers(room),
    shareUrl: publicShareUrlForCode(room.code),
  };
}

function isLoopbackHost(rawHost) {
  const host = String(rawHost || '').trim().toLowerCase();
  const hostname = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : host.replace(/:\d+$/, '');
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isPrivateIpv4(address) {
  return /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
    || /^169\.254\./.test(address);
}

function detectLanHost() {
  const configured = String(process.env.LAN_HOST || '').trim();
  if (configured) return configured;
  const candidates = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      const family = entry && entry.family;
      const address = String(entry?.address || '').trim();
      if (!entry || entry.internal || !(family === 'IPv4' || family === 4) || !address) continue;
      candidates.push(address);
    }
  }
  candidates.sort((a, b) => Number(isPrivateIpv4(b)) - Number(isPrivateIpv4(a)));
  return candidates[0] || '127.0.0.1';
}

function lanHostWithPort(requestedHost = `localhost:${PORT}`) {
  const host = String(requestedHost || '').trim();
  const portMatch = host.match(/:(\d+)$/);
  const port = portMatch ? portMatch[1] : String(PORT);
  return `${detectLanHost()}:${port}`;
}

// shareUrl 在 HTTP 请求生成时由 req 的 Host 决定；localhost 请求改用本机局域网地址。
function publicShareUrlForCode(code) {
  const envBase = process.env.PUBLIC_BASE_URL || '';
  const base = envBase.replace(/\/$/, '');
  if (base) return `${base}/?join=${code}`;
  return `http://${lanHostWithPort()}/?join=${code}`;
}

function clampWordDifficulty(value, fallback = 2) {
  const difficulty = Number(value);
  return Number.isFinite(difficulty) ? Math.min(3, Math.max(1, Math.round(difficulty))) : fallback;
}

function clampDrawability(value, fallback = 3) {
  const drawability = Number(value);
  return Number.isFinite(drawability) ? Math.min(5, Math.max(1, Math.round(drawability))) : fallback;
}

function normalizePoolEntry(entry, category, group = {}) {
  const item = typeof entry === 'string' ? { word: entry } : (entry || {});
  const word = String(item.word || '').trim();
  if (!word) return null;
  return {
    word,
    aliases: Array.isArray(item.aliases)
      ? [...new Set(item.aliases.map((alias) => String(alias || '').trim()).filter(Boolean))]
      : [],
    category: item.category || category,
    hint: String(item.hint || '').trim(),
    clue: String(item.clue || group.clue || '').trim(),
    difficulty: clampWordDifficulty(item.difficulty ?? group.difficulty, 2),
    drawability: clampDrawability(item.drawability ?? group.drawability, 3),
  };
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function buildWordPool(room) {
  const pool = [];
  const used = new Set((room.usedWords || []).map((word) => normalizeAnswer(word)));
  const exposed = new Set((room.exposedWords || []).map((word) => normalizeAnswer(word)));
  const seen = new Set();
  const customWords = room.config.customWords || [];
  const packs = room.config.wordPacks || {};
  const registry = room.wordPackRegistry || getWordPackRegistry();
  const selectedExternalPacks = Object.entries(packs)
    .filter(([id, enabled]) => enabled && id !== 'basic')
    .map(([id]) => registry.packs.get(id))
    .filter(Boolean);
  const anyPack = Boolean(packs.basic || selectedExternalPacks.length);
  const useSystemPacks = !room.config.customOnly || customWords.length === 0;
  const useBasic = useSystemPacks && (packs.basic !== false || (!anyPack && customWords.length === 0));

  const add = (entry) => {
    const item = entry && normalizePoolEntry(entry, entry.category, entry);
    if (!item) return;
    const key = normalizeAnswer(item.word);
    if (!key || used.has(key) || exposed.has(key) || seen.has(key)) return;
    seen.add(key);
    pool.push(item);
  };

  const addGroup = (group) => {
    for (const entry of group.words || []) {
      const item = normalizePoolEntry(entry, group.category, group);
      if (!item) continue;
      const key = normalizeAnswer(item.word);
      if (!key || used.has(key) || exposed.has(key) || seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  };

  const addExternalPacks = () => {
    for (const pack of selectedExternalPacks) {
      for (const group of pack.groups) addGroup(group);
    }
  };

  if (useBasic) {
    for (const group of WORD_BANK) addGroup(group);
  }
  if (useSystemPacks) addExternalPacks();
  for (const item of customWords) {
    const word = typeof item === 'string' ? item : item.word;
    const hint = typeof item === 'string' ? '' : (item.hint || '');
    add({
      word,
      category: '自定义',
      hint,
      clue: hint,
      difficulty: 2,
      drawability: 3,
    });
  }

  if (pool.length === 0) {
    room.usedWords = [];
    room.exposedWords = [];
    used.clear();
    exposed.clear();
    seen.clear();
    if (useBasic) {
      for (const group of WORD_BANK) {
        for (const entry of group.words || []) {
          const item = normalizePoolEntry(entry, group.category, group);
          if (!item) continue;
          const key = normalizeAnswer(item.word);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          pool.push(item);
        }
      }
    }
    if (useSystemPacks) addExternalPacks();
    for (const item of customWords) {
      const word = typeof item === 'string' ? item : item.word;
      const hint = typeof item === 'string' ? '' : (item.hint || '');
      add({ word, category: '自定义', hint, clue: hint, difficulty: 2, drawability: 3 });
    }
  }
  return pool;
}

function markWordUsed(room, word) {
  if (!room.usedWords.includes(word)) room.usedWords.push(word);
  room.word = word;
}

function pickWord(room) {
  const pool = buildWordPool(room);
  const picked = pool[Math.floor(Math.random() * pool.length)] || { word: '苹果', category: '食物', hint: '' };
  markWordUsed(room, picked.word);
  room.wordAliases = picked.aliases || [];
  room.wordCategory = picked.category;
  room.wordCustomHint = picked.hint || '';
  room.wordClue = picked.clue || '';
}

function pickWordOptions(room, count = 3) {
  const pool = buildWordPool(room);
  const selected = [];
  const remaining = shuffleItems(pool);
  const categories = new Set();
  // 所有内置题保持中等难度；三选一优先给不同类别，避免三个候选画法雷同。
  while (selected.length < count) {
    const index = remaining.findIndex((item) => !categories.has(item.category));
    if (index < 0) break;
    const item = remaining.splice(index, 1)[0];
    categories.add(item.category);
    selected.push(item);
  }
  while (selected.length < count && remaining.length > 0) selected.push(remaining.shift());
  return shuffleItems(selected).map((item) => ({
    word: item.word,
    category: item.category,
    hint: item.hint || '',
    clue: item.clue || '',
    difficulty: item.difficulty,
    drawability: item.drawability,
    aliases: item.aliases || [],
  }));
}

const RELAY_INTRO_MS = 3000;
const RELAY_COLLECT_MS = 4000;
const RELAY_REVEAL_MS = 30000;

function relayRoster(room) {
  if (room.relay && Array.isArray(room.relay.playerIds)) return room.relay.playerIds;
  return [...room.players.values()].filter((player) => player.online).map((player) => player.id);
}

function relayBookOf(room, playerId) {
  if (!room.relay) return -1;
  const slot = relayRoster(room).indexOf(playerId);
  if (slot < 0) return -1;
  const bookIndex = room.relay.assignments[slot];
  return Number.isInteger(bookIndex) && room.relay.books[bookIndex] ? bookIndex : -1;
}

function relayEntryKind(step) {
  return step % 2 === 1 ? 'draw' : 'guess';
}

function relayPlaceholder(kind) {
  return kind === 'draw'
    ? { type: 'draw', playerId: null, playerName: '无人作画', events: [], thumbnail: null, placeholder: true }
    : { type: 'guess', playerId: null, playerName: '缺席', text: '没猜出来', placeholder: true };
}

// 每一棒每本本子都要留下一条记录：缺席者用占位记录补上，否则下一棒读到的是上一轮的旧内容
function fillRelayEntry(room, bookIndex, step, entry) {
  const book = room.relay.books[bookIndex];
  if (!book || book.entries.length >= step) return false;
  while (book.entries.length < step - 1) {
    book.entries.push(relayPlaceholder(relayEntryKind(book.entries.length + 1)));
  }
  book.entries.push(entry);
  return true;
}

// 换棒时整条环顺时针移一本：名册增删不会让两个人拿到同一本，也不会让本子失去画手
function rotateRelayAssignments(room) {
  const count = room.relay.books.length;
  if (count <= 0) return;
  room.relay.assignments = room.relay.assignments.map((bookIndex) => (bookIndex + 1) % count);
}

function relayPromptForDraw(room, book, step) {
  const prev = book.entries[step - 2];
  if (step > 1 && prev && prev.type === 'guess' && !prev.placeholder) {
    return { promptType: 'guess', promptGuess: prev.text || '没猜出来' };
  }
  return { promptType: 'word', promptWord: book.originalWord, promptCategory: book.originalCategory };
}

function makeRelayBook(room, id, ownerId, item) {
  return {
    id,
    ownerId,
    originalWord: item.word,
    originalCategory: item.category || '',
    originalAliases: item.aliases || [],
    entries: [],
    ratings: new Map(),
  };
}

function relaySeedItem(room, usedWords) {
  const pool = buildWordPool(room);
  const fresh = pool.find((item) => !usedWords.has(item.word));
  return fresh || pool[Math.floor(Math.random() * pool.length)] || { word: '苹果', category: '食物' };
}

function startRelayGame(room) {
  const playerIds = relayRoster(room);
  const pool = shuffleItems(buildWordPool(room));
  room.relay = {
    // 名册只在开局固定成员、中途加入时追加，退出者保留座位：环状轮转依赖它保持稳定
    playerIds: [...playerIds],
    assignments: playerIds.map((_, i) => i),
    step: 0,
    totalSteps: room.config.relayPasses,
    books: playerIds.map((id, i) => makeRelayBook(room, i, id, pool[i] || { word: '苹果', category: '食物' })),
    guesses: new Map(),
    stepTasks: new Set(),
    stepExpected: 0,
    stepDone: 0,
  };
  room.relayDrawings = new Map();
  room.phase = 'relay_intro';
  room.deadline = Date.now() + RELAY_INTRO_MS;
  phaseChanged(room);
  systemChat(room, `传画接龙开始！共 ${room.relay.totalSteps} 棒，每人先画自己的秘密词`);
  broadcastPlayers(room);
  room.phaseTimer = setTimeout(() => beginRelayStep(room, 1), RELAY_INTRO_MS);
}

// 中途加入：多一本本子、多一个座位， assignments 仍是 0..n-1 的一个排列
function addMidgameRelayPlayer(room, player) {
  if (!room.relay) return;
  if (room.relay.playerIds.includes(player.id)) return;
  const usedWords = new Set(room.relay.books.map((book) => book.originalWord));
  const bookIndex = room.relay.books.length;
  room.relay.books.push(makeRelayBook(room, bookIndex, player.id, relaySeedItem(room, usedWords)));
  room.relay.playerIds.push(player.id);
  room.relay.assignments.push(bookIndex);
  broadcastPlayers(room);
  systemChat(room, `${player.nickname} 中途加入传画接龙，下一棒开始作画`);
}

function beginRelayStep(room, step) {
  clearRoomTimers(room);
  if (step > room.relay.totalSteps) {
    revealRelay(room);
    return;
  }
  const leavingStep = room.relay.step >= 1;
  room.relay.step = step;
  room.relay.guesses.clear();
  if (leavingStep) rotateRelayAssignments(room);
  const kind = relayEntryKind(step);
  room.phase = kind === 'draw' ? 'relay_draw' : 'relay_guess';
  room.deadline = Date.now() + (kind === 'draw' ? room.config.drawSeconds * 1000 : room.config.guessSeconds * 1000);
  room.relay.stepTasks = new Set();
  relayRoster(room).forEach((id, slot) => {
    const bookIndex = room.relay.assignments[slot];
    const book = room.relay.books[bookIndex];
    const player = room.players.get(id);
    if (!player || !player.online || !player.ws) {
      room.relayDrawings.delete(id);
      fillRelayEntry(room, bookIndex, step, relayPlaceholder(kind));
      return;
    }
    room.relay.stepTasks.add(id);
    if (kind === 'draw') {
      room.relayDrawings.set(player.id, {
        bookIndex,
        events: [],
        activeStrokes: new Set(),
        lastDrawAt: 0,
        // 每一棒都必须重新收集缩略图，否则上一棒的缩略图会让上传逻辑误判为已完成。
        thumbnail: null,
      });
      sendJson(player.ws, { type: 'relay_task', step, kind: 'draw', bookIndex, deadline: room.deadline, ...relayPromptForDraw(room, book, step) });
    } else {
      const draw = book.entries[step - 2];
      sendJson(player.ws, {
        type: 'relay_task',
        step,
        kind: 'guess',
        bookIndex,
        deadline: room.deadline,
        events: draw ? draw.events || [] : [],
        placeholder: draw && draw.events && draw.events.length ? '' : '上一棒没有留下画作',
      });
    }
  });
  room.relay.stepExpected = room.relay.stepTasks.size;
  room.relay.stepDone = 0;
  phaseChanged(room);
  systemChat(room, step % 2 === 1
    ? `第 ${step}/${room.relay.totalSteps} 棒：每个人正在秘密作画`
    : `第 ${step}/${room.relay.totalSteps} 棒：根据上一幅画猜词`);
  broadcastRelayProgress(room);
  if (room.relay.stepExpected === 0) {
    finalizeRelayStep(room);
    return;
  }
  room.phaseTimer = setTimeout(() => finalizeRelayStep(room), room.deadline - Date.now());
}

function relayProgressCounts(room) {
  if (room.phase === 'relay_collect') {
    const ids = relayRoster(room).filter((id) => room.relayDrawings.has(id));
    return { done: ids.filter((id) => room.relayDrawings.get(id).thumbnail).length, total: ids.length };
  }
  return { done: room.relay.stepDone, total: room.relay.stepExpected };
}

function broadcastRelayProgress(room) {
  const { done, total } = relayProgressCounts(room);
  broadcast(room, {
    type: 'relay_progress',
    step: room.relay.step,
    totalSteps: room.relay.totalSteps,
    done,
    total,
    deadline: room.deadline,
  });
}

function finalizeRelayStep(room) {
  if (room.phase === 'relay_draw') {
    const step = room.relay.step;
    relayRoster(room).forEach((id, slot) => {
      const bookIndex = room.relay.assignments[slot];
      const drawState = room.relayDrawings.get(id);
      if (!drawState || drawState.bookIndex !== bookIndex) return;
      const player = room.players.get(id);
      fillRelayEntry(room, bookIndex, step, {
        type: 'draw',
        playerId: id,
        playerName: player ? player.nickname : '已退出',
        events: drawState.events || [],
        thumbnail: null,
      });
    });
    room.phase = 'relay_collect';
    room.deadline = Date.now() + RELAY_COLLECT_MS;
    room.relay.stepDone = relayProgressCounts(room).done;
    phaseChanged(room);
    broadcastRelayProgress(room);
    systemChat(room, '作画结束，正在收集缩略图…');
    room.phaseTimer = setTimeout(() => finalizeRelayStep(room), RELAY_COLLECT_MS);
    return;
  }
  if (room.phase === 'relay_collect') {
    advanceRelayStep(room);
    return;
  }
  if (room.phase === 'relay_guess') {
    const step = room.relay.step;
    relayRoster(room).forEach((id, slot) => {
      if (room.relay.guesses.has(id)) return;
      const bookIndex = room.relay.assignments[slot];
      const book = room.relay.books[bookIndex];
      if (!book) return;
      const player = room.players.get(id);
      // 本棒没拿到过任务的人（加入时该棒已经开始）记缺席，不能替他们写一条带名字的猜测
      if (!room.relay.stepTasks.has(id)) {
        fillRelayEntry(room, bookIndex, step, relayPlaceholder('guess'));
        return;
      }
      fillRelayEntry(room, bookIndex, step, {
        type: 'guess',
        playerId: id,
        playerName: player ? player.nickname : '缺席',
        text: '没猜出来',
      });
    });
    advanceRelayStep(room);
  }
}

function advanceRelayStep(room) {
  if (room.relay.step >= room.relay.totalSteps) revealRelay(room);
  else beginRelayStep(room, room.relay.step + 1);
}

function handleRelayDraw(room, player, msg) {
  if (room.phase !== 'relay_draw') return;
  const drawState = room.relayDrawings.get(player.id);
  if (!drawState) return;
  const pushEvent = (event) => {
    event.from = player.id;
    drawState.events.push(event);
    if (drawState.events.length > MAX_RELAY_EVENTS) {
      drawState.events.splice(0, drawState.events.length - MAX_RELAY_EVENTS);
    }
  };
  if (msg.type === 'draw_begin') {
    const s = msg.stroke || {};
    const id = String(s.id || '').slice(0, 80);
    if (!id || drawState.activeStrokes.has(id)) return;
    const color = /^#[0-9a-fA-F]{6}$/.test(String(s.color || '')) ? String(s.color) : '#111827';
    const size = Math.min(0.05, Math.max(0.0008, Number(s.size) || 0.006));
    const allowedTools = new Set(['pen', 'crayon', 'pixel', 'highlighter', 'eraser', 'rect', 'circle', 'triangle']);
    const tool = allowedTools.has(s.tool) ? s.tool : 'pen';
    const start = validatePoint(s.x, s.y);
    if (!start) return;
    drawState.activeStrokes.add(id);
    pushEvent({ kind: 'begin', id, color, size, tool, x: start[0], y: start[1] });
    return;
  }
  if (msg.type === 'draw_points') {
    const now = Date.now();
    if (now - (drawState.lastDrawAt || 0) < 16) return;
    drawState.lastDrawAt = now;
    const id = String(msg.strokeId || '').slice(0, 80);
    if (!drawState.activeStrokes.has(id)) return;
    const points = [];
    for (const raw of (Array.isArray(msg.points) ? msg.points : []).slice(0, 256)) {
      if (!Array.isArray(raw)) continue;
      const pt = validatePoint(raw[0], raw[1]);
      if (pt) points.push(pt);
    }
    if (points.length) pushEvent({ kind: 'points', id, points });
    return;
  }
  if (msg.type === 'draw_fill') {
    const now = Date.now();
    if (now - (drawState.lastDrawAt || 0) < 60) return;
    drawState.lastDrawAt = now;
    const fill = msg.fill || {};
    const point = validatePoint(fill.x, fill.y);
    if (!point) return;
    const color = /^#[0-9a-fA-F]{6}$/.test(String(fill.color || '')) ? String(fill.color) : '#111827';
    const id = String(fill.id || `f_${Date.now().toString(36)}`).slice(0, 80);
    pushEvent({ kind: 'fill', id, x: point[0], y: point[1], color });
    return;
  }
  if (msg.type === 'draw_move') {
    const ids = Array.isArray(msg.ids)
      ? msg.ids.slice(0, 128).map((id) => String(id).slice(0, 80)).filter(Boolean)
      : [];
    const dx = Math.min(1, Math.max(-1, Number(msg.dx) || 0));
    const dy = Math.min(1, Math.max(-1, Number(msg.dy) || 0));
    if (!ids.length || (!dx && !dy)) return;
    pushEvent({ kind: 'move', ids, dx, dy });
    return;
  }
  if (msg.type === 'draw_end') {
    const id = String(msg.strokeId || '').slice(0, 80);
    if (!drawState.activeStrokes.has(id)) return;
    drawState.activeStrokes.delete(id);
    pushEvent({ kind: 'end', id });
    return;
  }
  if (msg.type === 'draw_undo') pushEvent({ kind: 'undo' });
  if (msg.type === 'draw_clear') {
    drawState.activeStrokes.clear();
    pushEvent({ kind: 'clear' });
  }
}

function handleRelayUpload(room, player, msg) {
  if (room.phase !== 'relay_collect') return;
  const drawState = room.relayDrawings.get(player.id);
  if (!drawState || drawState.thumbnail) return;
  const image = cleanThumbnail(msg.image);
  if (!image) {
    sendReject(player, 'bad_image', '缩略图格式不正确或过大');
    return;
  }
  drawState.thumbnail = image;
  const book = room.relay.books[drawState.bookIndex];
  const lastDraw = [...book.entries].reverse().find((e) => e.type === 'draw');
  if (lastDraw) lastDraw.thumbnail = image;
  sendJson(player.ws, { type: 'relay_upload_done' });
  broadcastRelayProgress(room);
}

function handleRelayGuess(room, player, msg) {
  if (room.phase !== 'relay_guess') return;
  const bookIndex = relayBookOf(room, player.id);
  if (bookIndex < 0 || room.relay.guesses.has(player.id)) return;
  const text = String(msg.text || '').trim().slice(0, 60) || '没猜出来';
  const filled = fillRelayEntry(room, bookIndex, room.relay.step, {
    type: 'guess',
    playerId: player.id,
    playerName: player.nickname,
    text,
  });
  if (!filled) return;
  room.relay.guesses.set(player.id, bookIndex);
  room.relay.stepDone += 1;
  sendJson(player.ws, { type: 'relay_guess_done', text });
  broadcastRelayProgress(room);
}

function handleRelayRate(room, player, msg) {
  if (room.phase !== 'relay_reveal') return;
  const book = room.relay.books[Number(msg.bookIndex)];
  if (!book) return;
  const kind = msg.kind === 'flower' ? 'flower' : msg.kind === 'veg' ? 'veg' : null;
  if (!kind) return;
  const now = Date.now();
  if (now - player.lastRateAt < 1200) return;
  player.lastRateAt = now;
  book.ratings.set(player.id, kind);
  const { flowerCount, vegCount } = relayRatingCounts(book);
  broadcast(room, {
    type: 'relay_rating',
    bookIndex: book.id,
    playerId: player.id,
    vegCount,
    flowerCount,
  });
}

function relayRatingCounts(book) {
  let flowerCount = 0;
  let vegCount = 0;
  for (const value of book.ratings.values()) {
    if (value === 'flower') flowerCount += 1;
    else vegCount += 1;
  }
  return { flowerCount, vegCount };
}

const RELAY_POINTS = { entry: 10, understood: 30, flower: 15 };

// 只加分不扣分：蔬菜只代表"没人猜对"，不该把参与者已经挣到的分收回去
function awardRelayScores(room) {
  if (!room.relay) return;
  for (const book of room.relay.books) {
    const { flowerCount } = relayRatingCounts(book);
    const contributors = new Set();
    book.entries.forEach((entry, i) => {
      if (entry.placeholder || !entry.playerId) return;
      const player = room.players.get(entry.playerId);
      if (!player) return;
      player.score += RELAY_POINTS.entry;
      contributors.add(player.id);
      if (entry.type !== 'draw') return;
      const next = book.entries[i + 1];
      if (!next || next.type !== 'guess' || next.placeholder) return;
      if (wordMatch(book.originalWord, next.text, book.originalAliases)) {
        player.score += RELAY_POINTS.understood;
      }
    });
    if (!flowerCount) continue;
    for (const id of contributors) {
      const player = room.players.get(id);
      if (player) player.score += flowerCount * RELAY_POINTS.flower;
    }
  }
  broadcastPlayers(room);
}

function relayRevealPayload(room) {
  return room.relay.books.map((book) => {
    const { flowerCount, vegCount } = relayRatingCounts(book);
    return {
      id: book.id,
      originalWord: book.originalWord,
      originalCategory: book.originalCategory,
      entries: book.entries.map((entry) => ({
        type: entry.type,
        playerName: entry.playerName,
        text: entry.text || '',
        thumbnail: entry.thumbnail || null,
      })),
      vegCount,
      flowerCount,
    };
  });
}

function revealRelay(room) {
  clearRoomTimers(room);
  room.phase = 'relay_reveal';
  room.deadline = Date.now() + RELAY_REVEAL_MS;
  broadcast(room, { type: 'relay_reveal', gameSeq: room.gameSeq, books: relayRevealPayload(room) });
  phaseChanged(room);
  systemChat(room, '🎉 揭晓时刻！看看词语是怎么被传歪的');
  room.phaseTimer = setTimeout(() => finishGame(room), RELAY_REVEAL_MS);
}

function syncRelayArtworksToGallery(room) {
  if (!room.relay) return;
  for (const book of room.relay.books) {
    const lastDraw = [...book.entries].reverse().find((e) => e.type === 'draw');
    const artworkId = `relay-${book.id}`;
    room.artworks.set(artworkId, {
      id: artworkId,
      round: 1,
      turnInRound: book.id + 1,
      word: book.originalWord,
      category: book.originalCategory || '传画接龙',
      drawerNickname: '传画接龙',
      uploaderId: null,
      thumbnail: lastDraw ? lastDraw.thumbnail : null,
      ratings: book.ratings,
      createdAt: Date.now(),
      correctTimes: [],
      fastestGuessMs: null,
      fastestGuessName: null,
      difficultyMs: room.config.drawSeconds * 1000,
      guessCount: 0,
    });
  }
}

function startGame(room, player) {
  if (player.id !== room.hostId) {
    sendJson(player.ws, { type: 'error', code: 'not_host', message: '只有房主可以开始游戏' });
    return;
  }
  if (room.phase !== 'waiting' && room.phase !== 'finished') {
    sendJson(player.ws, { type: 'error', code: 'bad_phase', message: '游戏正在进行中' });
    return;
  }
  const onlinePlayers = [...room.players.values()].filter((p) => p.online);
  const minPlayers = room.config.gameMode === 'relay' ? 3 : 2;
  if (onlinePlayers.length < minPlayers) {
    sendJson(player.ws, { type: 'error', code: 'not_enough_players', message: `至少需要 ${minPlayers} 名在线玩家` });
    return;
  }

  // 允许等待中的房间使用最新一次热读取结果；游戏开始后固定本局词库快照。
  room.wordPackRegistry = getWordPackRegistry();

  for (const p of room.players.values()) {
    p.score = 0;
    p.guessed = false;
  }
  // 再来一局保留当前房间的题目历史，避免已展示过的三选一候选重复出现。
  // 同时保留当前音乐：不停止播放、不清空点歌队列。
  room.status = 'playing';
  // 每一局一个序号：客户端的星尘奖励按它去重，否则同一房间的第二个完整局不再发奖
  room.gameSeq += 1;
  room.artworks.clear();
  if (room.config.gameMode === 'relay') {
    startRelayGame(room);
    return;
  }
  room.order = onlinePlayers.map((player) => player.id).sort(() => Math.random() - 0.5);
  room.drawerIndex = 0;
  room.round = 0;
  room.turnInRound = 0;
  room.turnsPlayed = 0;
  room.totalTurns = room.order.length * room.config.rounds;
  nextTurn(room);
}

function remainingDrawsForNewPlayer(room) {
  const currentRound = Math.max(1, room.round || 1);
  return Math.max(1, room.config.rounds - currentRound + 1);
}

// 回合总数随人数变化重算：本轮剩余槽位 + 之后每轮各一次（+ 尚未计入 turnsPlayed 的当前回合）
function recomputeTotalTurns(room) {
  if (room.totalTurns <= 0 || room.order.length === 0) return;
  const currentTurnPending = room.phase === 'result' ? 0 : 1;
  const usedThisRound = Math.min(room.turnInRound, room.order.length);
  const leftThisRound = room.order.length - usedThisRound;
  const roundsLeft = Math.max(0, room.config.rounds - room.round);
  room.totalTurns = room.turnsPlayed + currentTurnPending + leftThisRound + roundsLeft * room.order.length;
}

// 退出者留在 order 里会占掉一个画手槽位：同一个人会在同一轮画两次，playersPerRound 也会虚高
function removeFromRotation(room, playerId) {
  if (room.config.gameMode === 'relay') return;
  if (!Array.isArray(room.order) || room.order.length === 0) return;
  const index = room.order.indexOf(playerId);
  if (index < 0) return;
  room.drawerIndex %= room.order.length;
  room.order.splice(index, 1);
  if (room.drawerIndex > index) room.drawerIndex -= 1;
  if (room.order.length === 0) {
    room.totalTurns = room.turnsPlayed;
    return;
  }
  room.drawerIndex %= room.order.length;
  if (room.turnInRound > room.order.length) room.turnInRound = room.order.length;
  recomputeTotalTurns(room);
}

function addMidgamePlayerToRotation(room, player) {
  if (room.config.gameMode === 'relay') return;
  if (!room.players.has(player.id) || room.order.includes(player.id)) return;
  // 追加到本轮末尾：不影响已在进行中的画手顺序，新玩家本回合也能轮到
  room.order.push(player.id);
  room.totalTurns += remainingDrawsForNewPlayer(room);
}

// 经典模式：一轮 = 每位玩家都画过一次；中途加入会追加到本轮末尾并延长 totalTurns
function nextTurn(room) {
  if (room.totalTurns <= 0 || room.turnsPlayed >= room.totalTurns) {
    finishGame(room);
    return;
  }
  clearRoomTimers(room);
  room.turnInRound += 1;
  if (room.turnInRound > room.order.length) {
    room.turnInRound = 1;
    room.round += 1;
  }
  if (room.round < 1) room.round = 1;
  room.phase = 'prepare';
  room.paused = false;
  room.pauseDeadline = null;
  room.choosing = false;
  room.wordOptions = [];
  room.word = '';
  room.wordCategory = '';
  room.wordAliases = [];
  room.wordCustomHint = '';
  room.wordClue = '';
  let nextDrawer = null;
  let guard = 0;
  while (guard < room.order.length) {
    const candidateId = room.order[room.drawerIndex % room.order.length];
    room.drawerIndex += 1;
    guard += 1;
    const candidate = room.players.get(candidateId);
    if (candidate && candidate.online) {
      nextDrawer = candidate;
      break;
    }
  }
  if (!nextDrawer) {
    finishGame(room);
    return;
  }
  room.currentDrawerId = nextDrawer ? nextDrawer.id : null;
  room.events = [];
  room.activeStrokes.clear();
  room.correctGuesserIds = [];
  room.correctGuessRecords = [];
  room.revealedIndices = [];
  room.nextSeq = 1;
  for (const p of room.players.values()) p.guessed = false;

  const drawer = room.players.get(room.currentDrawerId);
  const drawerName = drawer ? drawer.nickname : '玩家';
  const roundLabel = `第 ${room.round}/${room.config.rounds} 轮 · 第 ${room.turnInRound}/${room.order.length} 位画手`;

  if (room.config.wordMode === 'choice') {
    room.choosing = true;
    room.wordOptions = pickWordOptions(room, 3);
    // 选项只发给画手，但同房玩家可能通过现场或口头交流看到它们；本局后续不再复用落选题。
    room.exposedWords.push(...room.wordOptions.map((option) => option.word));
    room.deadline = Date.now() + WORD_CHOOSE_MS;
    room.phaseTimer = setTimeout(() => chooseRoomWord(room, null), WORD_CHOOSE_MS);
    phaseChanged(room, { clear: true });
    if (drawer) {
      sendToPlayer(room, drawer.id, {
        type: 'word_options',
        options: room.wordOptions,
        deadline: room.deadline,
        round: room.round,
        turnInRound: room.turnInRound,
      });
    }
    broadcastPlayers(room);
    systemChat(room, `${roundLabel}：${drawerName} 正在 3 选 1 选题`);
    return;
  }

  pickWord(room);
  room.deadline = Date.now() + PREPARE_MS;
  room.phaseTimer = setTimeout(() => beginDraw(room), PREPARE_MS);
  phaseChanged(room, { clear: true });
  if (drawer) {
    sendToPlayer(room, drawer.id, {
      type: 'private_word',
      word: room.word,
      category: room.wordCategory,
      round: room.round,
      turnInRound: room.turnInRound,
    });
  }
  broadcastPlayers(room);
  systemChat(room, `${roundLabel}：${drawerName} 作画，题目类别「${room.wordCategory}」`);
}

function chooseRoomWord(room, index) {
  if (room.phase !== 'prepare' || !room.choosing) return;
  clearRoomTimers(room);
  let picked = null;
  if (Number.isInteger(index) && index >= 0 && index < room.wordOptions.length) {
    picked = room.wordOptions[index];
  } else if (room.wordOptions.length > 0) {
    picked = room.wordOptions[Math.floor(Math.random() * room.wordOptions.length)];
  }
  if (!picked) {
    pickWord(room);
  } else {
    markWordUsed(room, picked.word);
    room.wordAliases = picked.aliases || [];
    room.wordCategory = picked.category;
    room.wordCustomHint = picked.hint || '';
    room.wordClue = picked.clue || '';
  }
  room.wordOptions = [];
  room.choosing = false;

  const drawer = room.players.get(room.currentDrawerId);
  if (drawer) {
    sendToPlayer(room, drawer.id, {
      type: 'private_word',
      word: room.word,
      category: room.wordCategory,
      round: room.round,
      turnInRound: room.turnInRound,
    });
  }
  systemChat(room, `${drawer ? drawer.nickname : '画手'} 已选好题目，开始作画！`);
  beginDraw(room);
}

function beginDraw(room) {
  if (room.phase !== 'prepare') return;
  clearRoomTimers(room);
  room.phase = 'drawing';
  room.paused = false;
  room.deadline = Date.now() + room.config.drawSeconds * 1000;
  room.pauseDeadline = null;
  room.hintsShown = 0;
  room.phaseTimer = setTimeout(() => endRound(room, 'timeout'), room.config.drawSeconds * 1000);
  scheduleHints(room);
  phaseChanged(room);
  systemChat(room, `开始作画！${describeWord(room.word)}，输入答案猜词`);
}

function categoryHintText(category) {
  const map = {
    '动物': '这是一种动物',
    '食物': '这是一种食物，可以吃',
    '日常物品': '这是一种日常用品',
    '动作': '这是一个动作',
    '自然与场所': '这属于自然或场所',
    '表情与姿势': '这是一个表情或姿势',
    '成语': '这是一个四字成语，可以用故事或关键意象来表现',
    '情绪与心理': '这是可以通过表情、姿势或情境表现的感受',
    '网络梗': '这是一个常见的网络梗或聊天用语',
    // 兼容旧房间或旧自定义题目的分类名
    '网络热词': '这是一个网络热词或流行语',
    '社会现象': '这是一个社会现象或生活中的常见说法',
    '生活场景': '这是一个生活中的场景或经历',
    'English': '这是一个英文单词',
    '英雄联盟': '这是英雄联盟里的角色/装备/玩法',
    '幻兽帕鲁': '这是幻兽帕鲁里的帕鲁/物品/地点',
    '人物与职业': '这是一个人物或职业',
    '虚拟人物': '这是影视、动画、游戏或漫画里的知名角色',
    '交通工具': '这是一种交通工具',
    '植物': '这是一种植物',
    '身体部位': '这是身体的一个部位',
    '节日与传统': '这是一个节日或传统事物',
    '科技数码': '这是数码产品或科技用品',
    '服装配饰': '这是穿在身上的服装或配饰',
    '文具书籍': '这是文具或学习用品',
    '乐器': '这是一种乐器',
    '运动器材': '这是运动器材或体育用品',
    '家居电器': '这是家里常见的家具或电器',
    '自定义': '这是一个自定义词语',
  };
  return map[category] || `这个词的类型是：${category}`;
}

const HINT_TIMES = [0.3, 0.5, 0.7, 0.85];

function categoryClues(category) {
  const pool = {
    '动物': [
      '它可能出现在动物园、森林或家里',
      '它有自己的叫声或生活习性',
      '画手正在表现它的外形特征',
    ],
    '食物': [
      '它可能出现在餐桌上或零食袋里',
      '它的味道可能是甜的、咸的或酸的',
      '它通常是能吃的',
    ],
    '日常物品': [
      '家里、包里或桌上可能就有它',
      '它有具体的用途',
      '画手正在表现它的形状或使用方式',
    ],
    '动作': [
      '这是一个需要身体完成的动作',
      '它可能发生在运动、生活或娱乐中',
      '注意画手的动作姿势',
    ],
    '自然与场所': [
      '它可能是自然现象、地点或建筑',
      '旅行或户外时可能见过它',
      '它和天空、大地、海洋或城市有关',
    ],
    '表情与姿势': [
      '注意人物的身体轮廓和动作方向',
      '它通常可以用一个明确的姿势表现',
      '想想这个姿势表达的情绪或含义',
    ],
    '成语': [
      '可以画出成语里的关键人物、物品或动作',
      '想想这个成语背后的故事或画面',
      '它通常是四个字，注意表现整体意思',
    ],
    '情绪与心理': [
      '可以用表情、姿势或一个典型场景表现',
      '想想人在这种状态下会有什么反应',
      '它不是具体物品，重点画出感受',
    ],
    '网络梗': [
      '它常见于弹幕、评论区或聊天',
      '可以画一个大家熟悉的典型场景',
      '想想这个词通常在什么语境里出现',
    ],
    '网络热词': [
      '它常见于弹幕、评论区或短视频',
      '想想这个词通常在什么语境里出现',
      '可以用一个典型场景或动作来表现',
    ],
    '社会现象': [
      '它描述的是生活中一类常见现象',
      '可以画出相关人物和典型场景',
      '注意表现整体关系，不一定是具体物品',
    ],
    '生活场景': [
      '它可能发生在家里、学校、工作或出行中',
      '可以画出人物、地点和正在发生的事',
      '想想这个场景里最有代表性的动作',
    ],
    'English': [
      '先想中文意思，再翻译成英文',
      '它是英文单词，注意字母数量',
      '画手画的是它的含义',
    ],
    '英雄联盟': [
      '它出现在召唤师峡谷或 LOL 对局中',
      '可能是英雄、装备、地图元素或游戏术语',
      '想想技能、野怪、装备或英雄外号',
    ],
    '幻兽帕鲁': [
      '它出现在帕鲁世界里',
      '可能是帕鲁、物品、建筑或地点',
      '可能和捕捉、建造、骑乘或配种有关',
    ],
    '网络梗': [
      '它经常出现在弹幕、评论区或短视频里',
      '它可能是流行语、名场面或口头禅',
      '想想最近的网络热词',
    ],
    '自定义': [
      '这是房主出的题目',
      '想想你们平时的共同话题',
      '可能是人名、物品或你们之间的梗',
    ],
    '人物与职业': ['它和某种工作或身份有关', '想想谁每天在做这件事', '可能穿制服或使用专业工具'],
    '虚拟人物': ['它来自影视、动画、游戏或漫画', '想想这个角色最有辨识度的外形或道具', '角色可能有固定的伙伴、能力或口头禅'],
    '交通工具': ['它能把人或货物运到别的地方', '可能在路上、水里或天上', '画手在表现它的外形或用途'],
    '植物': ['它长在土里、水里或花盆里', '可能有叶子、花或果实', '大自然里或家里能见到'],
    '身体部位': ['它长在我们身上', '每个人都有这个部位', '注意画手画的位置'],
    '节日与传统': ['它和节日、庆祝或习俗有关', '可能出现在特定的日子里', '想一想红包、灯笼、月饼这类东西'],
    '科技数码': ['它和电子设备或数码产品有关', '可能通电或需要充电', '家里、办公室或口袋里可能有'],
    '服装配饰': ['它是穿在身上或戴在身上的', '出门前可能会用到它', '和穿搭、保暖或装饰有关'],
    '文具书籍': ['它和学习、办公或阅读有关', '书包或书桌上可能有', '可能是纸、笔或本子一类'],
    '乐器': ['它能发出声音或演奏音乐', '可能用手、嘴或鼓槌来演奏', '乐队或音乐课上见过'],
    '运动器材': ['它和运动或锻炼有关', '体育课、操场或健身房能见到', '用来打、踢、跳或举'],
    '家居电器': ['它通常出现在家里', '可能是家具或电器', '用来休息、收纳或做家务'],
  };
  const clues = pool[category] || [`这个词的类型是：${category}`];
  return clues[Math.floor(Math.random() * clues.length)];
}

function scheduleHints(room) {
  const total = room.config.drawSeconds * 1000;
  room.hintTimers = HINT_TIMES.map((ratio) => setTimeout(() => sendNextHint(room), total * ratio));
}

function resumeHints(room) {
  const remaining = room.deadline - Date.now();
  const missing = 4 - room.hintsShown;
  if (missing <= 0 || remaining <= 1000) return;
  const step = remaining / (missing + 1);
  room.hintTimers = [];
  for (let i = 0; i < missing; i += 1) {
    room.hintTimers.push(setTimeout(() => sendNextHint(room), step * (i + 1)));
  }
}

function defaultCustomClue(word) {
  const compact = String(word || '').replace(/\s/g, '');
  if (/^[a-zA-Z]+$/.test(compact)) {
    return `这是一个英文/拼音自定义词，共 ${Array.from(compact).length} 个字母`;
  }
  if (/[㐀-鿿豈-﫿]/.test(word) && !/[a-zA-Z0-9]/.test(compact)) {
    return '这是一个中文自定义词，想一想它代表的人、物品或事情';
  }
  return '这个词混合了中文和字母，注意它的写法和读法';
}

function sendNextHint(room) {
  if (room.phase !== 'drawing' || room.paused) return;
  const level = room.hintsShown + 1;
  if (level > 4) return;

  const chars = Array.from(room.word);
  const canReveal = chars.length >= 2;
  const indices = [...room.revealedIndices];
  const customHint = room.wordCategory === '自定义' ? (room.wordCustomHint || '') : '';
  const structuredClue = room.wordCategory === '自定义' ? '' : (room.wordClue || '');
  let text = '';
  let revealCount = indices.length;

  if (level === 1) {
    text = `${categoryHintText(room.wordCategory)}，${describeWord(room.word)}`;
  } else if (level === 2) {
    text = customHint
      ? `房主提示：${customHint}`
      : (structuredClue || categoryClues(room.wordCategory));
  } else if (level === 3 && canReveal) {
    room.revealedIndices = [0];
    indices.length = 0;
    indices.push(0);
    revealCount = 1;
    text = customHint
      ? `房主提示：${customHint}；第一个字/字母是「${chars[0]}」`
      : `${categoryHintText(room.wordCategory)}；第一个字/字母是「${chars[0]}」`;
  } else if (level === 3) {
    text = customHint ? `房主提示：${customHint}` : defaultCustomClue(room.word);
  } else {
    const correctCount = room.correctGuesserIds.length;
    const revealLast = chars.length >= 4 && !room.revealedIndices.includes(chars.length - 1);
    let extraText = '';
    if (revealLast) {
      room.revealedIndices.push(chars.length - 1);
      indices.length = 0;
      indices.push(...room.revealedIndices);
      revealCount = indices.length;
      extraText = `；首字「${chars[0]}」，尾字「${chars[chars.length - 1]}」`;
    }
    text = customHint
      ? `最后提示：${customHint}${extraText}；${describeWord(room.word)}${correctCount > 0 ? `，已有 ${correctCount} 人猜中` : ''}`
      : `最后提示：类别「${room.wordCategory}」${extraText}，${describeWord(room.word)}${correctCount > 0 ? `，已有 ${correctCount} 人猜中` : ''}`;
  }

  room.hintsShown = level;
  const masked = makeMask(room.word, indices);
  broadcast(room, {
    type: 'word_hint',
    level,
    text,
    masked,
    revealCount,
    description: describeWord(room.word),
  });
  systemChat(room, `提示 ${level}/4：${text}`);
}

function chooseArtworkUploader(room) {
  const drawer = room.players.get(room.currentDrawerId);
  if (drawer && drawer.online) return drawer.id;
  const orderIndex = new Map(room.order.map((id, index) => [id, index]));
  return [...room.players.values()]
    .filter((p) => p.online)
    .sort((a, b) => (orderIndex.get(a.id) ?? 999) - (orderIndex.get(b.id) ?? 999))
    .map((p) => p.id)[0] || null;
}

function artworkCounts(artwork) {
  let vegCount = 0;
  let flowerCount = 0;
  for (const kind of artwork.ratings.values()) {
    if (kind === 'veg') vegCount += 1;
    else if (kind === 'flower') flowerCount += 1;
  }
  return { vegCount, flowerCount };
}

function advanceAfterResult(room) {
  if (room.phase !== 'result') return;
  clearRoomTimers(room);
  room.skipVotes.clear();
  room.turnsPlayed += 1;
  if (room.totalTurns <= 0 || room.turnsPlayed >= room.totalTurns) finishGame(room);
  else nextTurn(room);
}

function endRound(room, reason) {
  if (room.phase !== 'drawing' && room.phase !== 'prepare') return;
  clearRoomTimers(room);
  room.phase = 'result';
  room.paused = false;
  room.pauseDeadline = null;
  room.deadline = null;
  room.skipVotes.clear();

  const perfect = reason === 'all_guessed';
  const duration = perfect ? PERFECT_RESULT_MS : RESULT_MS;
  room.resultDuration = duration;
  const artworkId = `${room.round}-${room.turnInRound}`;
  const drawer = room.players.get(room.currentDrawerId);
  const sortedTimes = [...room.correctGuessRecords]
    .sort((a, b) => a.elapsedMs - b.elapsedMs);
  const firstCorrect = sortedTimes[0] || null;
  const artwork = {
    id: artworkId,
    round: room.round,
    turnInRound: room.turnInRound,
    word: room.word,
    category: room.wordCategory,
    drawerNickname: drawer ? drawer.nickname : '未知画手',
    uploaderId: chooseArtworkUploader(room),
    thumbnail: null,
    ratings: new Map(),
    createdAt: Date.now(),
    correctTimes: sortedTimes,
    fastestGuessMs: firstCorrect ? firstCorrect.elapsedMs : null,
    fastestGuessName: firstCorrect ? firstCorrect.nickname : null,
    difficultyMs: firstCorrect ? firstCorrect.elapsedMs : room.config.drawSeconds * 1000,
    guessCount: sortedTimes.length,
  };
  room.artworks.set(artworkId, artwork);

  const correctNames = room.correctGuesserIds
    .map((id) => room.players.get(id))
    .filter(Boolean)
    .map((p) => p.nickname);

  broadcast(room, {
    type: 'round_result',
    gameSeq: room.gameSeq,
    round: room.round,
    totalRounds: room.config.rounds,
    turnInRound: room.turnInRound,
    playersPerRound: room.order.length,
    word: room.word,
    category: room.wordCategory,
    reason,
    perfect,
    artworkId,
    uploaderId: artwork.uploaderId,
    resultDuration: duration,
    skipVotes: 0,
    skipRequired: skipVoteRequired(room),
    thumbnail: null,
    vegCount: 0,
    flowerCount: 0,
    correctTimes: [...room.correctGuessRecords]
      .sort((a, b) => a.elapsedMs - b.elapsedMs)
      .slice(0, 10),
    correctGuesserNames: correctNames,
    scores: scoreList(room),
  });
  sendSkipVoteState(room);
  broadcastMusicState(room);
  broadcastPlayers(room);
  phaseChanged(room);

  room.phaseTimer = setTimeout(() => advanceAfterResult(room), duration);
}

function serializeGalleryArtwork(artwork) {
  const counts = artworkCounts(artwork);
  return {
    id: artwork.id,
    round: artwork.round,
    turnInRound: artwork.turnInRound,
    word: artwork.word,
    category: artwork.category,
    drawerNickname: artwork.drawerNickname,
    thumbnail: artwork.thumbnail || null,
    vegCount: counts.vegCount,
    flowerCount: counts.flowerCount,
    fastestGuessMs: artwork.fastestGuessMs,
    fastestGuessName: artwork.fastestGuessName,
    difficultyMs: artwork.difficultyMs,
    guessCount: artwork.guessCount,
  };
}

function buildGameOverPayload(room) {
  const scores = scoreList(room);
  const gallery = [...room.artworks.values()]
    .sort((a, b) => a.round - b.round || a.turnInRound - b.turnInRound)
    .map(serializeGalleryArtwork);

  const withGuess = gallery.filter((a) => a.fastestGuessMs != null);
  const byFlower = [...gallery].sort((a, b) => b.flowerCount - a.flowerCount || a.flowerCount - b.flowerCount);
  const byVeg = [...gallery].sort((a, b) => b.vegCount - a.vegCount || a.vegCount - b.vegCount);
  const byFast = [...withGuess].sort((a, b) => a.fastestGuessMs - b.fastestGuessMs);
  const byHard = [...gallery].sort((a, b) => b.difficultyMs - a.difficultyMs);

  return {
    type: 'game_over',
    gameSeq: room.gameSeq,
    scores,
    winnerId: scores[0] ? scores[0].id : null,
    gallery,
    awards: {
      fastest: byFast[0]
        ? { artworkId: byFast[0].id, nickname: byFast[0].fastestGuessName, elapsedMs: byFast[0].fastestGuessMs }
        : null,
      hardest: byHard[0]
        ? { artworkId: byHard[0].id, round: byHard[0].round, turnInRound: byHard[0].turnInRound, difficultyMs: byHard[0].difficultyMs }
        : null,
      bestFlower: byFlower[0] && byFlower[0].flowerCount > 0
        ? { artworkId: byFlower[0].id, flowerCount: byFlower[0].flowerCount }
        : null,
      weirdestVeg: byVeg[0] && byVeg[0].vegCount > 0
        ? { artworkId: byVeg[0].id, vegCount: byVeg[0].vegCount }
        : null,
    },
  };
}

function finishGame(room) {
  clearRoomTimers(room);
  if (!room.players.get(room.hostId)?.online) transferHost(room);
  room.phase = 'finished';
  room.status = 'finished';
  room.currentDrawerId = null;
  room.deadline = null;
  room.pauseDeadline = null;
  room.paused = false;
  if (room.config.gameMode === 'relay') {
    // 评分在揭晓窗口内持续到达，结算必须等到这里，否则鲜花分永远不计入
    awardRelayScores(room);
    syncRelayArtworksToGallery(room);
  }
  broadcast(room, buildGameOverPayload(room));
  broadcastMusicState(room);
  broadcastPlayers(room);
  phaseChanged(room);
}

function resetRoomToWaiting(room) {
  clearRoomTimers(room);
  room.status = 'waiting';
  room.phase = 'waiting';
  room.round = 0;
  room.turnInRound = 0;
  room.turnsPlayed = 0;
  room.totalTurns = 0;
  room.order = [];
  room.drawerIndex = 0;
  room.currentDrawerId = null;
  room.artworks.clear();
  room.relay = null;
  room.relayDrawings.clear();
  room.word = '';
  room.wordCategory = '';
  room.wordAliases = [];
  room.wordOptions = [];
  room.choosing = false;
  room.revealedIndices = [];
  room.wordCustomHint = '';
  room.wordClue = '';
  room.events = [];
  room.nextSeq = 1;
  room.activeStrokes.clear();
  room.correctGuesserIds = [];
  room.correctGuessRecords = [];
  room.hintsShown = 0;
  room.paused = false;
  room.deadline = null;
  room.pauseDeadline = null;
  room.pauseRemaining = 0;
  room.resultDuration = RESULT_MS;
  for (const p of room.players.values()) {
    p.score = 0;
    p.guessed = false;
  }
  // 返回房间保留当前题目历史和音乐：不清空题目去重记录，也不停止播放、不清空点歌队列。
  phaseChanged(room, { clear: true });
  broadcastPlayers(room);
}

function pauseDrawing(room) {
  if (room.phase !== 'drawing' || room.paused) return;
  room.paused = true;
  room.pauseRemaining = Math.max(1000, room.deadline - Date.now());
  clearRoomTimers(room);
  room.pauseDeadline = Date.now() + DRAWER_PAUSE_MS;
  room.pauseTimer = setTimeout(() => endRound(room, 'drawer_offline'), DRAWER_PAUSE_MS);
  phaseChanged(room);
  systemChat(room, '画手掉线，等待重连…');
}

function resumeDrawing(room) {
  if (room.phase !== 'drawing' || !room.paused) return;
  clearRoomTimers(room);
  room.paused = false;
  room.pauseDeadline = null;
  room.deadline = Date.now() + room.pauseRemaining;
  room.phaseTimer = setTimeout(() => endRound(room, 'timeout'), room.pauseRemaining);
  resumeHints(room);
  phaseChanged(room);
  systemChat(room, '画手已重连，继续作画！');
}

function handleCorrectGuess(room, player) {
  const drawer = room.players.get(room.currentDrawerId);
  const totalMs = Math.max(1000, room.config.drawSeconds * 1000);
  const remainingRatio = Math.max(0, Math.min(1, (room.deadline - Date.now()) / totalMs));
  const alreadyCorrect = room.correctGuesserIds.length;
  // 基础分 + 时间奖励：剩余时间越多，得分越高；随时间递减
  const basePoints = alreadyCorrect === 0 ? 100 : 60;
  const timeBonus = Math.round(100 * remainingRatio);
  const points = basePoints + timeBonus;
  player.score += points;
  if (drawer) drawer.score += 40;
  player.guessed = true;
  room.correctGuesserIds.push(player.id);
  const elapsedMs = Math.max(0, Math.round(totalMs - (room.deadline - Date.now())));
  room.correctGuessRecords.push({
    playerId: player.id,
    nickname: player.nickname,
    elapsedMs,
    points,
  });

  sendJson(player.ws, { type: 'guess_result', correct: true, points });
  broadcast(room, {
    type: 'guess_correct',
    playerId: player.id,
    nickname: player.nickname,
    points,
    correctCount: room.correctGuesserIds.length,
  });
  broadcastPlayers(room);

  // 只统计在线的猜词者：掉线但仍在房间内的玩家无法作答，否则回合会被拖到超时
  const guessers = [...room.players.values()].filter((p) => p.id !== room.currentDrawerId && p.online);
  if (guessers.length > 0 && guessers.every((p) => p.guessed)) {
    endRound(room, 'all_guessed');
  }
}

function appendDrawEvent(room, event) {
  const seq = room.nextSeq;
  room.nextSeq += 1;
  const stored = { seq, from: event.from, ...event };
  room.events.push(stored);
  if (room.events.length > MAX_EVENTS) {
    room.events.splice(0, room.events.length - MAX_EVENTS);
  }
  broadcast(room, { type: 'draw_event', seq, event: stored });
}

function validatePoint(x, y) {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return [Math.min(1, Math.max(0, nx)), Math.min(1, Math.max(0, ny))];
}

// 缩略图会被所有客户端拼进 <img src>，因此整串按 base64 字符集校验，不只看前缀。
function cleanThumbnail(raw) {
  const image = String(raw || '');
  if (image.length > MAX_THUMBNAIL_CHARS) return null;
  return DATA_IMAGE_RE.test(image) ? image : null;
}

function handleDraw(room, player, msg) {
  if (room.phase !== 'drawing' || room.paused || player.id !== room.currentDrawerId) {
    sendReject(player, 'not_drawer', '当前不是你的作画时间');
    return;
  }
  if (msg.type === 'draw_begin') {
    const s = msg.stroke || {};
    const id = String(s.id || '').slice(0, 80);
    if (!id || room.activeStrokes.has(id)) return;
    const color = /^#[0-9a-fA-F]{6}$/.test(String(s.color || '')) ? String(s.color) : '#111827';
    const size = Math.min(0.05, Math.max(0.0008, Number(s.size) || 0.006));
    const allowedTools = new Set(['pen', 'crayon', 'pixel', 'highlighter', 'eraser', 'rect', 'circle', 'triangle']);
    const tool = allowedTools.has(s.tool) ? s.tool : 'pen';
    const start = validatePoint(s.x, s.y);
    if (!start) return;
    room.activeStrokes.add(id);
    appendDrawEvent(room, {
      kind: 'begin',
      id,
      color,
      size,
      tool,
      x: start[0],
      y: start[1],
      from: player.id,
    });
    return;
  }

  if (msg.type === 'draw_points') {
    const now = Date.now();
    if (now - player.lastDrawAt < 16) return;
    player.lastDrawAt = now;
    const id = String(msg.strokeId || '').slice(0, 80);
    if (!room.activeStrokes.has(id)) return;
    const raw = Array.isArray(msg.points) ? msg.points.slice(0, 256) : [];
    const points = [];
    for (const p of raw) {
      if (!Array.isArray(p)) continue;
      const pt = validatePoint(p[0], p[1]);
      if (pt) points.push(pt);
    }
    if (points.length === 0) return;
    appendDrawEvent(room, { kind: 'points', id, points, from: player.id });
    return;
  }

  if (msg.type === 'draw_fill') {
    const now = Date.now();
    if (now - player.lastDrawAt < 60) return;
    player.lastDrawAt = now;
    const fill = msg.fill || {};
    const point = validatePoint(fill.x, fill.y);
    if (!point) return;
    const color = /^#[0-9a-fA-F]{6}$/.test(String(fill.color || '')) ? String(fill.color) : '#111827';
    const id = String(fill.id || `f_${Date.now().toString(36)}`).slice(0, 80);
    appendDrawEvent(room, { kind: 'fill', id, x: point[0], y: point[1], color, from: player.id });
    return;
  }

  if (msg.type === 'draw_move') {
    const ids = Array.isArray(msg.ids)
      ? msg.ids.slice(0, 128).map((id) => String(id).slice(0, 80)).filter(Boolean)
      : [];
    const dx = Math.min(1, Math.max(-1, Number(msg.dx) || 0));
    const dy = Math.min(1, Math.max(-1, Number(msg.dy) || 0));
    if (!ids.length || (!dx && !dy)) return;
    appendDrawEvent(room, { kind: 'move', ids, dx, dy, from: player.id });
    return;
  }

  if (msg.type === 'draw_end') {
    const id = String(msg.strokeId || '').slice(0, 80);
    if (!room.activeStrokes.has(id)) return;
    room.activeStrokes.delete(id);
    appendDrawEvent(room, { kind: 'end', id, from: player.id });
    return;
  }

  if (msg.type === 'draw_undo') {
    appendDrawEvent(room, { kind: 'undo', from: player.id });
    return;
  }

  if (msg.type === 'draw_clear') {
    room.activeStrokes.clear();
    appendDrawEvent(room, { kind: 'clear', from: player.id });
  }
}

function handleGuess(room, player, msg) {
  if (room.phase !== 'drawing' || room.paused) return;
  if (player.id === room.currentDrawerId) return;
  if (player.guessed) return;
  const text = String(msg.text || '').trim().slice(0, 60);
  if (!text) return;

  const matched = wordMatch(room.word, text, room.wordAliases);
  // 答对永远放行；答错做简单限流防刷屏
  if (!matched) {
    const now = Date.now();
    if (now - player.lastGuessAt < 700) return;
    player.lastGuessAt = now;
  }

  if (matched) {
    handleCorrectGuess(room, player);
  } else {
    sendJson(player.ws, { type: 'guess_result', correct: false });
    broadcast(room, {
      type: 'guess',
      playerId: player.id,
      nickname: player.nickname,
      text,
      ts: Date.now(),
    });
  }
}

function handleUploadArtwork(room, player, msg) {
  if (room.phase !== 'result') return;
  const artwork = room.artworks.get(String(msg.artworkId || ''));
  if (!artwork || artwork.uploaderId !== player.id) {
    sendReject(player, 'not_uploader', '当前不是缩略图上传者');
    return;
  }
  if (artwork.thumbnail) return;
  const image = cleanThumbnail(msg.image);
  if (!image) {
    sendReject(player, 'bad_image', '缩略图格式不正确或过大');
    return;
  }
  artwork.thumbnail = image;
  broadcast(room, {
    type: 'artwork_ready',
    artworkId: artwork.id,
    round: artwork.round,
    turnInRound: artwork.turnInRound,
    thumbnail: image,
  });
}

function handleRateArtwork(room, player, msg) {
  if (room.phase !== 'result') return;
  const artwork = room.artworks.get(String(msg.artworkId || ''));
  if (!artwork) return;
  const kind = msg.kind === 'flower' ? 'flower' : msg.kind === 'veg' ? 'veg' : null;
  if (!kind) return;

  const now = Date.now();
  if (now - player.lastRateAt < 1200) return;
  player.lastRateAt = now;

  artwork.ratings.set(player.id, kind);
  const counts = artworkCounts(artwork);
  broadcast(room, {
    type: 'artwork_rating',
    artworkId: artwork.id,
    playerId: player.id,
    fromNickname: player.nickname,
    fromKind: kind,
    vegCount: counts.vegCount,
    flowerCount: counts.flowerCount,
  });
}

function handleThrowItem(room, player, msg) {
  if (room.phase === 'waiting' || room.phase === 'finished') return;
  const allowedKinds = new Set(['veg', 'flower', 'poop']);
  const kind = allowedKinds.has(msg.kind) ? msg.kind : null;
  if (!kind) return;
  const now = Date.now();
  if (now - player.lastThrowAt < 1500) return;
  player.lastThrowAt = now;
  broadcast(room, {
    type: 'throw_item',
    playerId: player.id,
    nickname: player.nickname,
    kind,
    ts: Date.now(),
  });
}

function handleMemePack(room, player, msg) {
  if (room.phase === 'waiting' || room.phase === 'finished') return;
  const packId = String(msg.packId || '').trim();
  if (!MEME_PACK_IDS.has(packId)) return;
  const now = Date.now();
  if (now - player.lastMemePackAt < MEME_PACK_COOLDOWN_MS) return;
  player.lastMemePackAt = now;
  broadcast(room, {
    type: 'meme_pack',
    packId,
    playerId: player.id,
    nickname: player.nickname,
    ts: now,
  });
}

function isChatReveal(room, text) {
  if (!room.word || !text) return false;
  if (wordMatch(room.word, text, room.wordAliases)) return true;
  // 中文答案：聊天里只要包含答案词（如“答案是苹果”）也算泄题
  const answer = normalizeAnswer(room.word);
  const t = normalizeAnswer(text);
  if (/[\u4e00-\u9fff]/.test(room.word) && answer && t.includes(answer)) return true;
  const aliases = [...(WORD_ALIASES[room.word] || []), ...(room.wordAliases || [])];
  return aliases.some((alias) => {
    const a = normalizeAnswer(alias);
    return /[\u4e00-\u9fff]/.test(alias) && a && t.includes(a);
  });
}

function handleChat(room, player, msg) {
  const text = String(msg.text || '').trim().slice(0, MAX_CHAT);
  if (!text) return;
  // 画画/准备阶段禁止在聊天里直接报答案，避免已经猜对的人或画手泄题
  if ((room.phase === 'drawing' || (room.phase === 'prepare' && room.word)) && isChatReveal(room, text)) {
    sendJson(player.ws, { type: 'chat_blocked', message: '答案不能发在聊天里，请用“猜”提交' });
    return;
  }
  const now = Date.now();
  if (now - player.lastChatAt < 1200) return;
  player.lastChatAt = now;
  broadcast(room, {
    type: 'chat',
    playerId: player.id,
    nickname: player.nickname,
    text,
    ts: Date.now(),
  });
}

function transferHost(room, exceptId = null) {
  const candidates = [...room.players.values()]
    .filter((p) => p.id !== exceptId && p.online)
    .sort((a, b) => a.id.localeCompare(b.id));
  const nextHost = candidates[0] || [...room.players.values()].find((p) => p.id !== exceptId);
  if (nextHost) {
    room.hostId = nextHost.id;
    nextHost.isHost = true;
  }
  for (const p of room.players.values()) {
    if (p.id !== room.hostId) p.isHost = false;
  }
}

function removePlayer(room, player, reason = 'left') {
  room.skipVotes.delete(player.id);
  room.players.delete(player.id);
  removeFromRotation(room, player.id);
  if (player.isHost && room.players.size > 0) transferHost(room);

  if (room.players.size === 0) {
    deleteRoom(room);
    return;
  }

  if (room.phase === 'drawing' && room.currentDrawerId === player.id) {
    endRound(room, reason === 'kicked' ? 'drawer_kicked' : 'drawer_left');
  } else if (room.phase === 'prepare' && room.currentDrawerId === player.id) {
    if (room.choosing) {
      clearRoomTimers(room);
      pickWord(room);
      room.choosing = false;
      room.wordOptions = [];
    }
    endRound(room, 'drawer_left');
  }

  broadcastPlayers(room);
  systemChat(room, `${player.nickname} 离开了房间`);
  if (room.phase === 'result') sendSkipVoteState(room);
}

function detachPlayer(room, player) {
  player.online = false;
  player.ws = null;
  room.skipVotes.delete(player.id);
  if (player.isHost && (room.phase === 'waiting' || room.phase === 'finished')) {
    const onlineOthers = [...room.players.values()].some((p) => p.id !== player.id && p.online);
    if (onlineOthers) transferHost(room, player.id);
  }
  if (room.phase === 'prepare' && room.currentDrawerId === player.id) {
    if (room.choosing) {
      clearRoomTimers(room);
      pickWord(room);
      room.choosing = false;
      room.wordOptions = [];
    }
    endRound(room, 'drawer_offline');
  }
  broadcastPlayers(room);
  if (room.phase === 'drawing' && room.currentDrawerId === player.id && !room.paused) {
    pauseDrawing(room);
  }
  const anyoneOnline = [...room.players.values()].some((p) => p.online);
  if (!anyoneOnline && room.emptySince == null) room.emptySince = Date.now();
  if (room.phase === 'result') sendSkipVoteState(room);
}

function deleteRoom(room) {
  clearRoomTimers(room);
  clearRoomMusic(room);
  for (const player of room.players.values()) {
    if (player.ws) {
      try {
        player.ws.close(4001, 'room closed');
      } catch {
        // ignore
      }
      player.ws = null;
    }
  }
  roomsByCode.delete(room.code);
  rooms.delete(room.id);
}

function attachSocket(room, player, ws) {
  // 同一玩家重复连接时，踢掉旧连接
  if (player.ws && player.ws !== ws && player.ws.readyState === WebSocket.OPEN) {
    player.ws._superseded = true;
    player.ws.close(4008, 'duplicate connection');
  }
  player.ws = ws;
  player.online = true;
  ws.playerId = player.id;
  ws.room = room;
  room.emptySince = null;
  if ((room.phase === 'waiting' || room.phase === 'finished') && player.id !== room.hostId && !room.players.get(room.hostId)?.online) {
    transferHost(room);
  }

  sendJson(ws, roomStateFor(room, player));
  if (room.phase === 'prepare' && room.choosing && room.currentDrawerId === player.id) {
    sendJson(ws, {
      type: 'word_options',
      options: room.wordOptions,
      deadline: room.deadline,
      round: room.round,
      turnInRound: room.turnInRound,
    });
  } else if ((room.phase === 'prepare' || room.phase === 'drawing') && room.currentDrawerId === player.id && room.word) {
    sendJson(ws, {
      type: 'private_word',
      word: room.word,
      category: room.wordCategory,
      round: room.round,
      turnInRound: room.turnInRound,
    });
  }
  if (room.events.length > 0) {
    sendJson(ws, { type: 'draw_replay', events: room.events });
  }

  // 传画接龙：补发当前私人任务。只补发给本棒真的拿到过任务的人，
  // 中途加入者和缺席者在本棒没有记录，重新发一份会让他们替别人作画。
  if (room.relay && (room.phase === 'relay_draw' || room.phase === 'relay_guess')) {
    const step = room.relay.step;
    const bookIndex = relayBookOf(room, player.id);
    const tasked = bookIndex >= 0 && room.relay.stepTasks.has(player.id) && !room.relay.guesses.has(player.id);
    if (tasked) {
      const book = room.relay.books[bookIndex];
      if (room.phase === 'relay_draw') {
        const drawState = room.relayDrawings.get(player.id);
        sendJson(ws, {
          type: 'relay_task', step, kind: 'draw', bookIndex,
          deadline: room.deadline,
          events: drawState ? drawState.events : [],
          ...relayPromptForDraw(room, book, step),
        });
      } else {
        const draw = book.entries[step - 2];
        sendJson(ws, {
          type: 'relay_task',
          step,
          kind: 'guess',
          bookIndex,
          deadline: room.deadline,
          events: draw ? draw.events || [] : [],
          placeholder: draw && draw.events && draw.events.length ? '' : '上一棒没有留下画作',
        });
      }
    }
    broadcastRelayProgress(room);
  } else if (room.relay && room.phase === 'relay_collect') {
    const drawState = room.relayDrawings.get(player.id);
    if (drawState && !drawState.thumbnail) {
      sendJson(ws, { type: 'relay_collect', deadline: room.deadline });
    }
  } else if (room.relay && room.phase === 'relay_reveal') {
    sendJson(ws, { type: 'relay_reveal', gameSeq: room.gameSeq, books: relayRevealPayload(room) });
  }

  if (room.phase === 'result') {
    const names = room.correctGuesserIds
      .map((id) => room.players.get(id))
      .filter(Boolean)
      .map((p2) => p2.nickname);
    const artworkId = `${room.round}-${room.turnInRound}`;
    const artwork = room.artworks.get(artworkId);
    const counts = artwork ? artworkCounts(artwork) : { vegCount: 0, flowerCount: 0 };
    const resultDuration = room.resultDuration || RESULT_MS;
    sendJson(ws, {
      type: 'round_result',
      round: room.round,
      totalRounds: room.config.rounds,
      turnInRound: room.turnInRound,
      playersPerRound: room.order.length,
      word: room.word,
      category: room.wordCategory,
      gameSeq: room.gameSeq,
      reason: 'rejoined',
      perfect: false,
      artworkId,
      uploaderId: artwork ? artwork.uploaderId : null,
      resultDuration,
      skipVotes: skipVoteCount(room),
      skipRequired: skipVoteRequired(room),
      skipVoted: room.skipVotes.has(player.id),
      thumbnail: artwork ? artwork.thumbnail : null,
      vegCount: counts.vegCount,
      flowerCount: counts.flowerCount,
      myKind: artwork && player ? (artwork.ratings.get(player.id) || null) : null,
      correctTimes: [...room.correctGuessRecords]
        .sort((a, b) => a.elapsedMs - b.elapsedMs)
        .slice(0, 10),
      correctGuesserNames: names,
      scores: scoreList(room),
    });
    sendSkipVoteState(room);
  } else if (room.phase === 'finished') {
    sendJson(ws, buildGameOverPayload(room));
  }

  sendJson(ws, {
    type: 'music_state',
    queue: serializeMusicQueue(room),
    current: serializeMusicCurrent(room),
  });
  broadcastPlayers(room);

  if (room.paused && room.phase === 'drawing' && room.currentDrawerId === player.id) {
    resumeDrawing(room);
  }
}

function publicRoomInfo(room) {
  if (!room) return null;
  return {
    exists: true,
    code: room.code,
    status: room.status,
    phase: room.phase,
    playerCount: room.players.size,
    maxPlayers: room.config.maxPlayers,
    rounds: room.config.rounds,
    gameSeq: room.gameSeq,
    drawSeconds: room.config.drawSeconds,
    wordMode: room.config.wordMode,
    customWordCount: (room.config.customWords || []).length,
  };
}

function publicBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const proto = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
  const requestedHost = forwardedHost || req.headers.host || `localhost:${PORT}`;
  const host = forwardedHost || (isLoopbackHost(requestedHost) ? lanHostWithPort(requestedHost) : requestedHost);
  return `${proto}://${host}`;
}

function shareUrlFor(req, code) {
  const envBase = process.env.PUBLIC_BASE_URL || '';
  if (envBase) return `${envBase.replace(/\/$/, '')}/?join=${code}`;
  return `${publicBaseUrl(req)}/?join=${code}`;
}

function sendJsonResponse(res, status, obj) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname, searchParams) {
  // GET /api/word-packs：返回当前热读取到的词库目录（不暴露题目内容）
  if (pathname === '/api/word-packs' && req.method === 'GET') {
    sendJsonResponse(res, 200, getWordPackCatalog());
    return;
  }

  // GET /api/rooms：返回可加入的在线房间列表
  if (pathname === '/api/rooms' && req.method === 'GET') {
    const rooms = [...roomsByCode.values()]
      .filter((room) => room.players.size > 0 && room.players.size < room.config.maxPlayers)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((room) => ({
        code: room.code,
        playerCount: room.players.size,
        maxPlayers: room.config.maxPlayers,
        status: room.status,
        phase: room.phase,
        createdAt: room.createdAt,
      }));
    sendJsonResponse(res, 200, { rooms });
    return;
  }

  // POST /api/rooms
  if (pathname === '/api/rooms' && req.method === 'POST') {
    if (roomsByCode.size >= MAX_ROOMS) {
      const now = Date.now();
      for (const room of [...roomsByCode.values()]) {
        const anyOnline = [...room.players.values()].some((player) => player.online);
        if (!anyOnline && room.emptySince && now - room.emptySince > ROOM_EMPTY_TTL) deleteRoom(room);
      }
      if (roomsByCode.size >= MAX_ROOMS) {
        sendJsonResponse(res, 429, { error: '当前房间数已达上限，请稍后再试' });
        return;
      }
    }
    const body = await readJsonBody(req);
    let preferredCode = null;
    if (body.roomCode !== undefined && body.roomCode !== null && String(body.roomCode).trim() !== '') {
      preferredCode = cleanRoomCode(body.roomCode);
      if (!preferredCode) {
        sendJsonResponse(res, 400, { error: '房间号格式不正确：请使用 4-8 位字母或数字' });
        return;
      }
      if (roomsByCode.has(preferredCode)) {
        sendJsonResponse(res, 409, { error: `房间号 ${preferredCode} 已被使用` });
        return;
      }
    }
    const room = createRoom(preferredCode);
    const player = makePlayer(cleanNickname(body.nickname));
    player.isHost = true;
    room.hostId = player.id;
    room.players.set(player.id, player);
    rooms.set(room.id, room);
    roomsByCode.set(room.code, room);
    const shareUrl = shareUrlFor(req, room.code);
    sendJsonResponse(res, 201, {
      room: { code: room.code, shareUrl, ...publicRoomInfo(room) },
      player: { id: player.id, nickname: player.nickname, token: player.token, isHost: true },
      shareUrl,
    });
    return;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/(qr\.svg|join|rejoin))?$/);
  if (roomMatch) {
    const code = roomMatch[1].toUpperCase();
    const room = roomsByCode.get(code);
    const action = roomMatch[2] || null;

    if (pathname === `/api/rooms/${code}/join` && req.method === 'POST') {
      if (!room) {
        sendJsonResponse(res, 404, { error: '房间不存在或已关闭' });
        return;
      }
      const body = await readJsonBody(req);
      const requestedNickname = cleanNickname(body.nickname);

      // 只有同时提供原玩家 ID 和令牌，才能恢复离线身份。
      // 仅凭昵称重连会让新访客冒充房主或其他断线玩家。
      const existing = [...room.players.values()].find((p) => p.nickname === requestedNickname);
      const requestedPlayerId = String(body.playerId || '').trim();
      const requestedToken = String(body.token || '').trim();
      let player = null;
      let rejoined = false;
      if (existing && !existing.online && requestedPlayerId === existing.id && requestedToken === existing.token) {
        player = existing;
        rejoined = true;
      } else {
        if (room.players.size >= room.config.maxPlayers) {
          sendJsonResponse(res, 409, { error: '房间人数已满' });
          return;
        }
        let nickname = requestedNickname;
        const usedNames = new Set([...room.players.values()].map((p) => p.nickname));
        if (usedNames.has(nickname)) {
          let n = 2;
          while (usedNames.has(`${nickname}${n}`) && n < 100) n += 1;
          nickname = `${nickname}${n}`;
        }
        player = makePlayer(nickname);
        room.players.set(player.id, player);
      }

      if (rejoined) {
        systemChat(room, `${player.nickname} 重新加入了房间`);
      } else {
        if (room.phase !== 'waiting' && room.phase !== 'finished') {
          if (room.relay) addMidgameRelayPlayer(room, player);
          else addMidgamePlayerToRotation(room, player);
        }
        broadcastPlayers(room);
        systemChat(room, `${player.nickname} 加入了房间`);
      }
      const shareUrl = shareUrlFor(req, room.code);
      sendJsonResponse(res, 200, {
        room: { code: room.code, shareUrl, ...publicRoomInfo(room) },
        player: {
          id: player.id,
          nickname: player.nickname,
          token: player.token,
          isHost: player.isHost,
        },
        rejoined,
        shareUrl,
      });
      return;
    }

    if (pathname === `/api/rooms/${code}/rejoin` && req.method === 'POST') {
      if (!room) {
        sendJsonResponse(res, 404, { error: '房间不存在或已关闭' });
        return;
      }
      const body = await readJsonBody(req);
      const player = room.players.get(String(body.playerId || ''));
      if (!player || player.token !== String(body.token || '')) {
        sendJsonResponse(res, 401, { error: '身份已失效，请重新加入' });
        return;
      }
      sendJsonResponse(res, 200, {
        room: { code: room.code, ...publicRoomInfo(room) },
        player: { id: player.id, nickname: player.nickname, token: player.token },
        shareUrl: shareUrlFor(req, room.code),
      });
      return;
    }

    if (action === 'qr.svg' && req.method === 'GET') {
      if (!room) {
        sendJsonResponse(res, 404, { error: '房间不存在' });
        return;
      }
      const url = shareUrlFor(req, room.code);
      try {
        const svg = await QRCode.toString(url, {
          type: 'svg',
          margin: 2,
          width: 320,
          color: { dark: '#111827', light: '#ffffff' },
        });
        res.writeHead(200, {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'public, max-age=60',
        });
        res.end(svg);
      } catch {
        sendJsonResponse(res, 500, { error: '二维码生成失败' });
      }
      return;
    }

    if (req.method === 'GET') {
      if (!room) {
        sendJsonResponse(res, 404, { error: '房间不存在' });
        return;
      }
      sendJsonResponse(res, 200, publicRoomInfo(room));
      return;
    }
  }

  // 音乐缓存文件服务（B 站 BV 号下载的本地音频）
  const musicFileMatch = pathname.match(/^\/api\/music\/file\/([^/]+)$/);
  if (musicFileMatch && req.method === 'GET') {
    const key = decodeURIComponent(musicFileMatch[1]);
    const cached = musicCache.get(key);
    if (!cached || !existsSync(cached.path)) {
      sendJsonResponse(res, 404, { error: '音频文件不存在或已被清理' });
      return;
    }
    try {
      touchMusicCache(key);
      const lowerPath = cached.path.toLowerCase();
      let contentType = 'audio/mpeg';
      if (lowerPath.endsWith('.m4a') || lowerPath.endsWith('.m4s') || lowerPath.endsWith('.mp4') || lowerPath.endsWith('.aac')) {
        contentType = 'audio/mp4';
      } else if (lowerPath.endsWith('.webm')) {
        contentType = 'audio/webm';
      } else if (lowerPath.endsWith('.opus') || lowerPath.endsWith('.ogg')) {
        contentType = 'audio/ogg';
      }
      const fileSize = statSync(cached.path).size;
      const range = req.headers.range;
      let start = 0;
      let end = fileSize - 1;
      let status = 200;
      const headers = {
        'content-type': contentType,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600',
      };
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (m) {
          let s = m[1] !== '' ? parseInt(m[1], 10) : NaN;
          let e = m[2] !== '' ? parseInt(m[2], 10) : NaN;
          if (Number.isNaN(s)) s = 0;
          if (Number.isNaN(e)) e = fileSize - 1;
          if (s >= 0 && s < fileSize && s <= e) {
            start = s;
            end = Math.min(e, fileSize - 1);
            status = 206;
            headers['content-range'] = `bytes ${start}-${end}/${fileSize}`;
          } else {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            res.end();
            return;
          }
        }
      }
      headers['content-length'] = end - start + 1;
      res.writeHead(status, headers);
      const stream = createReadStream(cached.path, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.destroy();
      });
      stream.pipe(res);
    } catch {
      sendJsonResponse(res, 500, { error: '音频读取失败' });
    }
    return;
  }

  sendJsonResponse(res, 404, { error: '接口不存在' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

async function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) {
    sendJsonResponse(res, 403, { error: 'forbidden' });
    return true;
  }
  try {
    const stat = await import('node:fs/promises').then((fs) => fs.stat(file));
    if (!stat.isFile()) return false;
  } catch {
    return false;
  }
  const data = await readFile(file);
  const ext = path.extname(file).toLowerCase();
  const isPenSkinAsset = rel.startsWith('assets/pen-skins/');
  const cacheControl = isPenSkinAsset
    ? 'public, max-age=31536000, immutable'
    : (ext === '.html' || ext === '.css' || ext === '.js'
      ? 'no-store'
      : 'public, max-age=3600');
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': cacheControl,
    'content-length': String(data.length),
  });
  res.end(data);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, url.searchParams);
      return;
    }
    const served = await handleStatic(req, res, pathname);
    if (!served) {
      sendJsonResponse(res, 404, { error: '页面不存在' });
    }
  } catch (err) {
    if (!res.headersSent) {
      sendJsonResponse(res, 400, { error: err.message || '请求错误' });
    } else {
      res.end();
    }
  }
});

const wss = new WebSocketServer({ noServer: true });

wss.on('error', (err) => {
  console.error(`  ⚠️ WebSocket 服务错误：${err.message}`);
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws._authed = false;
  ws._superseded = false;
  ws._origin = String(req?.headers?.origin || '').trim();
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.authTimer = setTimeout(() => {
    if (!ws._authed) ws.close(4000, 'auth timeout');
  }, 10000);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'auth') {
      const code = String(msg.roomCode || '').toUpperCase();
      const room = roomsByCode.get(code);
      const player = room ? room.players.get(String(msg.playerId || '')) : null;
      if (!room || !player || player.token !== String(msg.token || '')) {
        sendJson(ws, { type: 'error', code: 'auth_failed', message: '身份验证失败，请重新加入房间' });
        ws.close(4001, 'auth failed');
        return;
      }
      ws._authed = true;
      if (ws.authTimer) clearTimeout(ws.authTimer);
      attachSocket(room, player, ws);
      return;
    }

    if (!ws._authed || !ws.room) return;
    const room = ws.room;
    const player = room.players.get(ws.playerId);
    if (!player) return;

    switch (msg.type) {
      case 'set_pen_skin': {
        const penSkinId = String(msg.skinId || '').trim();
        if (!PEN_SKIN_IDS.has(penSkinId)) break;
        player.penSkinId = penSkinId;
        broadcastPlayers(room);
        break;
      }
      case 'pen_legendary_announce':
        handlePenLegendaryAnnounce(room, player, msg);
        break;
      case 'pen_gacha_grant':
        handlePenGachaGrant(room, player, ws, msg);
        break;
      case 'start_game':
        startGame(room, player);
        break;
      case 'play_again':
        if (player.id === room.hostId && room.phase === 'finished') startGame(room, player);
        break;
      case 'back_to_room':
        if (player.id === room.hostId && room.phase === 'finished') resetRoomToWaiting(room);
        break;
      case 'update_config':
        if (player.id === room.hostId && room.phase === 'waiting') {
          const rounds = Math.min(10, Math.max(1, Number(msg.rounds) || room.config.rounds));
          const drawSeconds = Math.min(180, Math.max(30, Number(msg.drawSeconds) || room.config.drawSeconds));
          room.config.rounds = Math.round(rounds);
          room.config.drawSeconds = Math.round(drawSeconds);
          if (msg.wordMode === 'choice' || msg.wordMode === 'random') {
            room.config.wordMode = msg.wordMode;
          }
          if (msg.customWords !== undefined) {
            room.config.customWords = cleanCustomWords(msg.customWords);
          }
          if (msg.customOnly !== undefined) {
            room.config.customOnly = Boolean(msg.customOnly);
          }
          if (msg.wordPacks && typeof msg.wordPacks === 'object' && !Array.isArray(msg.wordPacks)) {
            const allowedPackIds = new Set(['basic', ...getWordPackRegistry().packs.keys()]);
            const nextPacks = {};
            for (const [packId, enabled] of Object.entries(msg.wordPacks)) {
              if (allowedPackIds.has(packId)) nextPacks[packId] = Boolean(enabled);
            }
            room.config.wordPacks = nextPacks;
          }
          if (msg.basicWords !== undefined) {
            room.config.wordPacks.basic = Boolean(msg.basicWords);
          }
          if (msg.lolWords !== undefined) {
            room.config.wordPacks.lol = Boolean(msg.lolWords);
          }
          if (msg.palworldWords !== undefined) {
            room.config.wordPacks.palworld = Boolean(msg.palworldWords);
          }
          // 网络梗词库已合并进基础词库，不再作为独立开关
          delete room.config.wordPacks.meme;
          if (msg.gameMode === 'classic' || msg.gameMode === 'relay') {
            room.config.gameMode = msg.gameMode;
          }
          if (msg.relayPasses !== undefined) {
            room.config.relayPasses = Math.min(5, Math.max(3, Number(msg.relayPasses) || room.config.relayPasses));
          }
          if (msg.guessSeconds !== undefined) {
            room.config.guessSeconds = Math.min(90, Math.max(15, Number(msg.guessSeconds) || room.config.guessSeconds));
          }
          for (const p of room.players.values()) {
            const configForPlayer = p.isHost
              ? { ...room.config, customWords: [...room.config.customWords] }
              : { ...room.config, customWords: [] };
            sendToPlayer(room, p.id, { type: 'room_config', config: configForPlayer });
          }
        }
        break;
      case 'choose_word':
        if (room.phase === 'prepare' && room.choosing && player.id === room.currentDrawerId) {
          chooseRoomWord(room, Number.isInteger(msg.index) ? msg.index : null);
        }
        break;
      case 'draw_begin':
      case 'draw_points':
      case 'draw_end':
      case 'draw_fill':
      case 'draw_move':
      case 'draw_undo':
      case 'draw_clear':
        if (room.config.gameMode === 'relay') handleRelayDraw(room, player, msg);
        else handleDraw(room, player, msg);
        break;
      case 'relay_guess':
        handleRelayGuess(room, player, msg);
        break;
      case 'relay_upload':
        handleRelayUpload(room, player, msg);
        break;
      case 'relay_rate':
        handleRelayRate(room, player, msg);
        break;
      case 'guess':
        handleGuess(room, player, msg);
        break;
      case 'chat':
        handleChat(room, player, msg);
        break;
      case 'throw_item':
        handleThrowItem(room, player, msg);
        break;
      case 'meme_pack':
        handleMemePack(room, player, msg);
        break;
      case 'upload_artwork':
        handleUploadArtwork(room, player, msg);
        break;
      case 'rate_artwork':
        handleRateArtwork(room, player, msg);
        break;
      case 'skip_vote':
        handleSkipVote(room, player);
        break;
      case 'music_gd_search':
        handleGdSearch(room, player, msg);
        break;
      case 'music_gd_request':
        handleGdRequest(room, player, msg);
        break;
      case 'music_bili_resolve':
        handleBiliResolve(room, player, msg);
        break;
      case 'music_bili_request':
        handleBiliRequest(room, player, msg);
        break;
      case 'music_skip':
        handleMusicSkip(room, player);
        break;
      case 'music_stop':
        handleMusicStop(room, player);
        break;
      case 'music_finished':
        handleMusicFinished(room, player, msg);
        break;
      case 'kick':
        if (player.id === room.hostId && room.phase === 'waiting') {
          const target = room.players.get(String(msg.playerId || ''));
          if (target && target.id !== player.id) {
            sendJson(target.ws, { type: 'kicked', message: '你被房主移出了房间' });
            if (target.ws) target.ws.close(4003, 'kicked');
            room.players.delete(target.id);
            broadcastPlayers(room);
            systemChat(room, `${target.nickname} 被移出房间`);
          }
        }
        break;
      case 'leave':
        if (room.players.has(player.id)) {
          removePlayer(room, player, 'left');
          try {
            ws.close(1000, 'left');
          } catch {
            // ignore
          }
        }
        break;
      case 'ping':
        sendJson(ws, { type: 'pong', ts: Date.now() });
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.authTimer) clearTimeout(ws.authTimer);
    if (ws._superseded) return;
    const room = ws.room;
    const player = room ? room.players.get(ws.playerId) : null;
    if (room && player && player.ws === ws) {
      detachPlayer(room, player);
    }
  });

  ws.on('error', () => {
    // 由 close 统一处理
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    const anyOnline = [...room.players.values()].some((p) => p.online);
    const idleTooLong = !anyOnline && room.emptySince && now - room.emptySince > ROOM_EMPTY_TTL;
    const stale = now - room.createdAt > ROOM_MAX_IDLE && !anyOnline;
    if (idleTooLong || stale) deleteRoom(room);
  }
}, 60000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  ❌ 端口 ${PORT} 已被占用，无法启动。`);
    console.error('  可能原因：已经打开了一个游戏服务窗口。');
    console.error('');
    console.error('  解决方法：');
    console.error('    1. 找到旧窗口并关闭，或按 Ctrl+C 结束旧服务');
    console.error(`    2. 或者换一个端口启动：PORT=${PORT + 1} npm start`);
    console.error('');
    process.exit(1);
  }
  throw err;
});

startWordPackWatcher();

server.listen(PORT, () => {
  console.log('');
  console.log('  🎨 你画我猜服务已启动');
  console.log(`  本机访问:  http://localhost:${PORT}`);
  console.log(`  局域网访问: http://<本机局域网IP>:${PORT}`);
  console.log('');
  console.log('  内网穿透示例:');
  console.log(`    cloudflared tunnel --url http://localhost:${PORT}`);
  console.log(`    cpolar http ${PORT}`);
  console.log(`    ngrok http ${PORT}`);
  console.log('');
});

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(cleanup);
  for (const room of rooms.values()) deleteRoom(room);
  wss.close();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
