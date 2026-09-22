import { Harness, TINY_PNG, sleep, drawStrokes } from './lib.mjs';
import { makeRoom } from './classic.mjs';

export function attachRelayPilot(h, bots, opts = {}) {
  if (!h.relayPilot) {
    h.relayPilot = {
      drawMs: 500, draw: 'all', upload: 'all', guessDelay: 200, guess: 'auto',
      rate: true, guessText: (bookIndex, step) => `词${bookIndex}棒${step}`,
      ...opts,
    };
  } else Object.assign(h.relayPilot, opts);
  // 中途加入者再次挂载时复用同一条链，否则已注册 handler 写入的是旧 Map
  const chain = h.relayChain || { guesses: new Map(), draws: new Map(), prompts: new Map() };
  h.relayChain = chain;
  for (const bot of bots) {
    if (bot.__relay) continue;
    bot.__relay = { tasks: [], drew: false };
    bot.on('relay_task', (m) => {
      const o = h.relayPilot;
      bot.__relay.tasks.push(m);
      if (m.kind === 'draw') {
        bot.__relay.drew = false;
        if (m.promptType === 'word') chain.prompts.set(`${m.bookIndex}@${m.step}`, `W:${m.promptWord}`);
        else chain.prompts.set(`${m.bookIndex}@${m.step}`, `G:${m.promptGuess}`);
        if (o.draw !== 'none' && (o.draw === 'all' || o.draw(bot))) {
          setTimeout(async () => {
            await drawStrokes(bot, o.drawMs, { phase: 'relay_draw' });
            bot.__relay.drew = true;
            chain.draws.set(`${m.bookIndex}@${m.step}`, bot.name);
          }, 40);
        }
      } else if (m.kind === 'guess') {
        if (o.guess === 'none' || (typeof o.guess === 'function' && !o.guess(bot))) return;
        setTimeout(() => {
          const text = o.guessText(m.bookIndex, m.step);
          chain.guesses.set(`${m.bookIndex}@${m.step}`, text);
          bot.send({ type: 'relay_guess', text });
        }, o.guessDelay + Math.random() * 150);
      }
    });
    bot.on('phase_changed', (m) => {
      const o = h.relayPilot;
      if (m.phase === 'relay_collect') {
        setTimeout(() => {
          const should = o.upload === 'all' ? true : (o.upload === 'only-if-drew' ? bot.__relay.drew : false);
          const task = [...bot.__relay.tasks].reverse().find((t) => t.kind === 'draw');
          if (!should || !task || bot.__relay.suppressUpload) return;
          bot.send({ type: 'relay_upload', bookIndex: task.bookIndex, image: TINY_PNG });
        }, 80);
      }
    });
    bot.on('relay_reveal', (m) => {
      const o = h.relayPilot;
      if (!o.rate) return;
      (m.books || []).forEach((book, i) => {
        setTimeout(() => bot.send({ type: 'relay_rate', bookIndex: book.id, kind: 'flower' }), 30 * i + Math.random() * 30);
      });
    });
  }
  return { pilot: h.relayPilot, chain };
}

export async function startRelay(h, bots, { passes, drawSeconds, guessSeconds, wordMode } = {}) {
  const host = bots[0];
  host.send({
    type: 'update_config',
    gameMode: 'relay',
    relayPasses: passes ?? 3,
    drawSeconds: drawSeconds ?? (h.fast ? 5 : 30),
    guessSeconds: guessSeconds ?? (h.fast ? 5 : 15),
    ...(wordMode ? { wordMode } : {}),
  });
  await host.waitFor('room_config', (m) => m.config.gameMode === 'relay' && m.config.relayPasses === (passes ?? 3));
  for (const b of bots) b.mark();
  host.send({ type: 'start_game' });
}

// 通用一致性检查
export function checkRelayIntegrity(h, bots, { passes, players, expectBooks = players }) {
  const host = bots[0];
  const revealMsg = host.msgs.filter((m) => m.type === 'relay_reveal').pop();
  if (!revealMsg) { h.fail('relay', '没有收到 relay_reveal'); return null; }
  const books = revealMsg.books || [];
  h.expect(books.length === expectBooks, `揭晓书籍数=${expectBooks}`, `books=${books.length}`);
  const chain = h.relayChain || { prompts: new Map(), guesses: new Map() };
  for (const book of books) {
    const entries = book.entries || [];
    const drawCount = entries.filter((e) => e.type === 'draw').length;
    const guessCount = entries.filter((e) => e.type === 'guess').length;
    const expectedDraws = Math.ceil(passes / 2);
    const expectedGuesses = Math.floor(passes / 2);
    h.expect(entries.length === passes, `第 ${book.id} 本共 ${passes} 条记录`, `book=${book.id} entries=${entries.length} types=${entries.map((e) => e.type[0]).join('')}`);
    h.expect(drawCount === expectedDraws, `第 ${book.id} 本有 ${expectedDraws} 幅画`, `draw=${drawCount}`);
    h.expect(guessCount === expectedGuesses, `第 ${book.id} 本有 ${expectedGuesses} 次猜测`, `guess=${guessCount}`);
    h.expect(!!book.originalWord, `第 ${book.id} 本有原始词`, book.originalWord);
    entries.forEach((e, i) => {
      if (i > 0 && e.type === entries[i - 1].type) h.fail('relay', `第 ${book.id} 本第 ${i} 条与上一条同类型`, entries.map((x) => x.type).join(','));
    });
  }
  // 接龙链：第 s 棒的作画提示必须等于第 s-1 棒写进同一本子的猜测
  for (const [key, prompt] of chain.prompts) {
    const [b, s] = key.split('@');
    const step = Number(s);
    if (step === 1) continue;
    if (!prompt.startsWith('G:')) continue;
    const prev = chain.guesses.get(`${b}@${step - 1}`);
    if (prev === undefined) { h.note(`链检查：${key} 上一棒无人猜测`); continue; }
    if (prompt.slice(2) !== prev) h.fail('relay', `接龙链断裂：第 ${b} 本第 ${step} 棒提示「${prompt.slice(2)}」≠ 上一棒猜测「${prev}」`);
  }
  return revealMsg;
}

// 真实计时下"等下一棒"要跨过整段作画/猜词窗口（30~40 秒），缩放计时几秒就到
const nextMs = (h, fastMs, realMs = 60000) => (h.fast ? fastMs : Math.max(fastMs, realMs));

const test = (name, fn) => scenarios.push({ name, fn });
export const scenarios = [];

test('传画-3人3棒-完整链路', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  const over = await bots[0].waitFor('game_over', () => true, h.fast ? 30000 : 200000);
  const reveal = checkRelayIntegrity(h, bots, { passes: 3, players: 3 });
  h.expect(reveal.books.every((b) => b.entries.filter((e) => e.type === 'draw').every((e) => e.thumbnail)), '每幅画都带缩略图');
  h.expect(over.gallery.length === 3, '画廊按本子生成 3 张', `gallery=${over.gallery.length}`);
  h.expect(over.scores.length === 3, '排行榜 3 人');
  const total = over.scores.reduce((a, b) => a + b.score, 0);
  const detail = JSON.stringify(over.scores.map((s) => [s.nickname, s.score]));
  h.expect(over.scores.every((s) => s.score >= 30), '每人 3 条有效记录各计 10 分', detail);
  h.expect(total > 90, '揭晓窗口内投出的鲜花计入总分（评分在 finishGame 才结算）', `total=${total} ${detail}`);
  h.expect(!!over.awards.bestFlower, '传画评分进入画廊奖项', JSON.stringify(over.awards));
  h.note(`传画计分：${over.scores.map((s) => `${s.nickname}=${s.score}`).join(' ')}`);
});

test('传画-4人默认4棒', async (h) => {
  const { bots } = await makeRoom(h, { players: 4, config: { gameMode: 'relay', relayPasses: 4, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 4 });
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  checkRelayIntegrity(h, bots, { passes: 4, players: 4 });
  const progress = bots[0].msgs.filter((m) => m.type === 'relay_progress');
  h.expect(progress.every((p) => p.done <= p.total), 'relay_progress 中 done 不超过 total', JSON.stringify(progress.map((p) => [p.done, p.total])));
  h.expect(progress.some((p) => p.total === 4 && p.done === 4), '收集阶段能看到全员完成', JSON.stringify(progress.map((p) => [p.step, p.done, p.total])));
});

test('传画-5棒奇数收尾', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 5, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 5 });
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  checkRelayIntegrity(h, bots, { passes: 5, players: 3 });
});

function dumpBooks(reveal) {
  return (reveal.books || []).map((b) => `本${b.id}[${b.originalWord}](${b.entries.map((e) => `${e.type[0]}:${e.playerName || ''}`).join('>') || '空'})`).join(' ');
}

test('传画-作画阶段有人退出', async (h) => {
  const { bots } = await makeRoom(h, { players: 4, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 6 : 40, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  await bots[0].waitFor('relay_task', (m) => m.kind === 'draw');
  await sleep(300);
  bots[3].leaveRoom();
  const over = await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  h.expect(!!over, '退出后本局仍能结束');
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  h.expect(!!reveal, '仍有揭晓');
  h.note(`退出后揭晓结构：${dumpBooks(reveal)}`);
  const books = reveal.books || [];
  h.expect(books.length === 4, '本子数量应等于开局人数（退出者不应被抹掉）', `books=${books.length}`);
  const empty = books.filter((b) => !b.entries.length);
  h.expect(empty.length === 0, '不应有被完全遗忘的本子', `empty=${empty.map((b) => b.id).join(',')}`);
  books.forEach((b) => {
    const draws = b.entries.filter((e) => e.type === 'draw').length;
    const guesses = b.entries.filter((e) => e.type === 'guess').length;
    h.expect(draws + guesses === 3, `第 ${b.id} 本记录数完整`, `entries=${draws + guesses} types=${b.entries.map((e) => e.type[0]).join('')}`);
  });
  const perStepDraw = new Map();
  for (const b of books) for (const e of b.entries) if (e.type === 'draw') perStepDraw.set(`${b.id}`, (perStepDraw.get(`${b.id}`) || 0) + 1);
  const progress = bots[0].msgs.filter((m) => m.type === 'relay_progress');
  const bad = progress.filter((p) => p.done > p.total);
  h.expect(bad.length === 0, '退出后 done 不应超过 total', JSON.stringify(progress.map((p) => [p.step, p.done, p.total])));
  const collect = progress.filter((p) => p.total === 3);
  h.expect(collect.some((p) => p.done === 3), '剩余 3 人全部上传后进度应到 3/3', JSON.stringify(collect.map((p) => p.done)));
});

test('传画-有人掉线但不退出', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 6 : 40, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  await bots[0].waitFor('relay_task', (m) => m.kind === 'draw');
  await sleep(300);
  bots[2].drop(); // 只断线，不退出房间
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  h.note(`掉线未退出时的揭晓结构：${dumpBooks(reveal)}`);
  const blank = reveal.books.flatMap((b) => b.entries).filter((e) => e.type === 'draw' && !e.thumbnail);
  const ownDrawSteps = [1, 3].length; // 3 棒里奇数步是作画，掉线者占 2 个作画位
  h.expect(blank.length === ownDrawSteps, '掉线者只让自己的作画棒变空白，不影响别人的画面', `blankDraws=${blank.length} 预期=${ownDrawSteps}`);
  h.expect(reveal.books.length === 3, '掉线不会改变书本数量', `books=${reveal.books.length}`);
  const othersOk = reveal.books.filter((b) => b.entries.every((e) => e.type !== 'draw' || e.thumbnail || e.playerName === '玩家3'));
  h.expect(othersOk.length >= 1, '至少有一本完全没被掉线影响', `ok=${othersOk.map((b) => b.id).join(',')}`);
  h.note(`空白画分布：${reveal.books.map((b) => `${b.id}[${b.entries.filter((e) => e.type === 'draw' && !e.thumbnail).length}空]`).join(' ')}`);
  const stalled = reveal.books.filter((b) => b.entries.some((e) => e.type === 'draw' && !e.thumbnail) && b.entries.slice(-1)[0]?.type === 'draw');
  h.note(`以空白画收尾的本子：${stalled.map((b) => b.id).join(',') || '无'}`);
});

test('传画-猜词阶段有人退出', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 8 : 30 } });
  attachRelayPilot(h, bots, { guess: (b) => b.name !== '玩家2' });
  await startRelay(h, bots, { passes: 3 });
  await bots[0].waitFor('relay_task', (m) => m.kind === 'guess', nextMs(h, 12000));
  bots.find((b) => b.name === '玩家2').leaveRoom();
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  h.expect(!!reveal, '猜词阶段退出后仍能揭晓');
  const totalEntries = reveal.books.reduce((a, b) => a + b.entries.length, 0);
  h.note(`剩余 2 人 × 3 棒 = ${totalEntries} 条记录，书本数 ${reveal.books.length}`);
  checkRelayIntegrity(h, bots, { passes: 3, players: 3, expectBooks: 3 });
});

test('传画-有人摆烂不画不传', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots, { draw: (b) => b.name !== '玩家2', upload: 'only-if-drew' });
  await startRelay(h, bots, { passes: 3 });
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  const emptyDraws = reveal.books.flatMap((b) => b.entries).filter((e) => e.type === 'draw' && !e.thumbnail);
  h.expect(emptyDraws.length >= 1, '空白画作以无缩略图形式进入揭晓', `empty=${emptyDraws.length}`);
  const progress = bots[0].msgs.filter((m) => m.type === 'relay_progress' && m.step === 1);
  h.expect(progress.some((p) => p.done === 2 && p.total === 3), '收集进度显示 2/3', JSON.stringify(progress.map((p) => [p.done, p.total])));
});

test('传画-人数门槛与中途加入', async (h) => {
  h.expectErrorCodes('not_drawer', 'not_enough_players');
  const { bots, code } = await makeRoom(h, { players: 2, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  bots[0].mark();
  bots[0].send({ type: 'start_game' });
  const err = await bots[0].waitFor('error', (m) => m.code === 'not_enough_players', 3000).catch(() => null);
  h.expect(!!err, '传画接龙不足 3 人时给出明确错误', err ? err.message : '无回执');

  const third = await h.bot('玩家3');
  await third.join(code);
  await third.connect();
  bots.push(third);
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  await bots[0].waitFor('relay_task', (m) => m.kind === 'draw');
  const outsider = await h.bot('场外');
  const joinRes = await outsider.join(code);
  h.expect(!!joinRes.player, '传画接龙允许中途加入', JSON.stringify(joinRes.json || joinRes));
  await outsider.connect();
  bots.push(outsider);
  attachRelayPilot(h, bots);
  const st = await outsider.waitFor('room_state', () => true, 3000);
  h.expect(st.room.gameMode === 'relay' || st.room.config?.gameMode === 'relay', '加入者看到房间处于传画模式', JSON.stringify(st.room).slice(0, 160));
  const t2 = await outsider.waitFor('relay_task', () => true, nextMs(h, 20000, 90000));
  h.expect(t2.step >= 2, '中途加入者从下一棒开始接笔，不抢已过半的棒', `step=${t2.step}`);
  const over = await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const reveal = checkRelayIntegrity(h, bots, { passes: 3, players: 4, expectBooks: 4 });
  const ids = reveal.books.map((b) => b.id);
  h.expect(new Set(ids).size === 4, '本子 id 不重复', ids.join(','));
  h.expect(over.scores.length === 4, '加入者进入排行榜', `scores=${over.scores.length}`);
  const joinerScore = over.scores.find((s) => s.nickname === '场外');
  h.expect(!!joinerScore && joinerScore.score >= 20, '加入者自己的两棒（猜+画）都能得分', JSON.stringify(joinerScore));
});

test('传画-非法协议消息', async (h) => {
  h.expectErrorCodes('not_drawer', 'bad_image');
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 6 : 30, guessSeconds: h.fast ? 8 : 15 } });
  attachRelayPilot(h, bots, { guess: 'none', rate: false });
  await startRelay(h, bots, { passes: 3 });
  const drawTask = await bots[1].waitFor('relay_task', (m) => m.kind === 'draw');

  // 作画阶段非法输入
  bots[1].mark();
  bots[1].send({ type: 'draw_begin', stroke: { id: 'x', color: '<script>', size: 99, tool: 'bomb', x: 5, y: -3 } });
  await sleep(150);
  bots[1].send({ type: 'relay_upload', bookIndex: drawTask.bookIndex, image: TINY_PNG });
  bots[1].send({ type: 'relay_rate', bookIndex: 0, kind: 'flower' });
  bots[1].send({ type: 'relay_rate', bookIndex: 99, kind: 'bad' });
  await sleep(300);
  h.expect(!bots[1].msgs.slice(bots[1].read).some((m) => m.type === 'relay_upload_done'), '作画阶段上传缩略图被忽略');
  h.expect(!bots[1].msgs.some((m) => m.type === 'relay_rating'), '揭晓前评分被忽略');

  // 收集阶段：超大缩略图 / 非法格式（关掉这台的自动上传，避免和辅助脚本抢时序）
  bots[2].__relay.suppressUpload = true;
  await bots[0].waitFor('phase_changed', (m) => m.phase === 'relay_collect', nextMs(h, 20000, 90000));
  bots[2].mark();
  const before = bots[2].msgs.filter((m) => m.type === 'relay_upload_done').length;
  bots[2].send({ type: 'relay_upload', bookIndex: drawTask.bookIndex, image: 'data:image/png;base64,' + 'A'.repeat(400000) });
  await sleep(40);
  bots[2].send({ type: 'relay_upload', bookIndex: drawTask.bookIndex, image: 'javascript:alert(1)' });
  await sleep(400);
  const rejected = bots[2].msgs.slice(bots[2].read).filter((m) => m.type === 'error' && m.code === 'bad_image');
  h.expect(bots[2].msgs.filter((m) => m.type === 'relay_upload_done').length === before,
    '超大/非法缩略图被拒绝', `before=${before}`);
  h.expect(rejected.length >= 1, '非法缩略图有 bad_image 回执，客户端知道要重传', JSON.stringify(rejected.map((m) => m.code)));
  h.expect(rejected.length === 1, '同一错误码 1500ms 内只回执一次', JSON.stringify(rejected.map((m) => m.code)));

  // 猜词阶段：重复提交 / 空文本 / 超长文本
  await bots[1].waitFor('relay_task', (m) => m.kind === 'guess', 20000);
  bots[1].send({ type: 'relay_guess', text: '第一次' });
  const done1 = await bots[1].waitFor('relay_guess_done', () => true, 3000);
  h.expect(done1.text === '第一次', '首次猜测被接受', JSON.stringify(done1));
  bots[1].send({ type: 'relay_guess', text: '第二次' });
  await sleep(400);
  h.expect(bots[1].msgs.filter((m) => m.type === 'relay_guess_done').length === 1, '同一棒重复猜测被拒绝');
  const unguessed = bots.filter((b) => b !== bots[1]);
  unguessed[0].send({ type: 'relay_guess', text: 'x'.repeat(500) });
  const long = await unguessed[0].waitFor('relay_guess_done', () => true, 3000).catch(() => null);
  h.expect(!!long && long.text.length <= 60, '超长猜测被截断', long && `${long.text.length}`);
  unguessed[1].send({ type: 'relay_guess', text: '   ' });
  const blank = await unguessed[1].waitFor('relay_guess_done', () => true, 3000).catch(() => null);
  h.expect(!!blank, '空文本猜测被兜底为“没猜出来”', blank && blank.text);

  await bots[0].waitFor('game_over', () => true, h.fast ? 60000 : 400000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  h.note(`非法消息后的揭晓结构：${dumpBooks(reveal)}`);
  h.expect(!!reveal, '非法消息未打断本局');
  const texts = reveal.books.flatMap((b) => b.entries.map((e) => e.text || ''));
  h.expect(!texts.some((t) => t.includes('<script>') || t.startsWith('javascript:')), '揭晓内容不含未清洗的可疑字符串', texts.join('|').slice(0, 120));
});

test('传画-掉线重连补发任务', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 8 : 40, guessSeconds: h.fast ? 8 : 20 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  const t = await bots[1].waitFor('relay_task', (m) => m.kind === 'draw');
  await sleep(400);
  const dropper = bots[1];
  dropper.drop();
  await sleep(400);
  await dropper.reconnect();
  const replay = await dropper.waitFor('relay_task', (m) => m.kind === 'draw' && m.step === t.step, 5000);
  h.expect(!!replay, '重连后补发作画任务');
  h.expect(Array.isArray(replay.events), '补发任务带当前笔迹');
  if (t.promptType === 'word') {
    h.expect(replay.promptWord === t.promptWord, '重连后秘密词保持一致', `${t.promptWord} -> ${replay.promptWord}`);
  }
  // 重连后继续画并上传
  await drawStrokes(dropper, 300);
  const collectPhase = await dropper.waitFor('phase_changed', (m) => m.phase === 'relay_collect', nextMs(h, 15000, 90000));
  dropper.send({ type: 'relay_upload', bookIndex: replay.bookIndex, image: TINY_PNG });
  const up = await dropper.waitFor('relay_upload_done', () => true, 3000);
  h.expect(!!up, '重连后仍能上传缩略图');
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  checkRelayIntegrity(h, bots, { passes: 3, players: 3 });
});

test('传画-再来一局状态复位', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  const host = bots[0];
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  await host.waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const first = host.msgs.filter((m) => m.type === 'relay_reveal').pop();
  for (const b of bots) { b.mark(); b.__relay.tasks = []; }
  host.send({ type: 'play_again' });
  await host.waitFor('relay_task', (m) => m.kind === 'draw', 10000);
  await host.waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const second = host.msgs.filter((m) => m.type === 'relay_reveal').pop();
  h.expect(!!second, '第二局有揭晓');
  h.expect(second !== first, '第二局产生了新的揭晓数据');
  h.expect(second.books.every((b) => b.entries.length === 3), '第二局每本记录数正确', JSON.stringify(second.books.map((b) => b.entries.length)));
  h.expect(second.books.every((b) => b.entries.filter((e) => e.type === 'draw').every((e) => e.thumbnail)), '第二局缩略图齐全（未残留上一棒状态）');
  const gallery = host.msgs.filter((m) => m.type === 'game_over').pop();
  h.expect(gallery.gallery.length === 3, '画廊不累积上一局', `gallery=${gallery.gallery.length}`);
});

test('传画-模式互不影响', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  const host = bots[0];
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'relay_draw');
  h.expect(dp.wordMasked === '', '传画阶段不泄漏任何题面', `mask=${dp.wordMasked}`);
  h.expect(dp.round === 0, '传画不使用经典回合号', `round=${dp.round}`);
  const over = await host.waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  h.expect(over.awards.fastest === null, '传画不应产生最快猜中奖', JSON.stringify(over.awards));
});

test('传画-揭晓阶段重连不丢评分', async (h) => {
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  const host = bots[0];
  attachRelayPilot(h, bots, { rate: false });
  await startRelay(h, bots, { passes: 3 });
  const reveal = await host.waitFor('relay_reveal', () => true, h.fast ? 40000 : 300000);
  h.expect(!!reveal, '进入揭晓阶段');
  for (const b of bots) b.send({ type: 'relay_rate', bookIndex: 0, kind: 'flower' });
  await sleep(1500); // 服务端每人打分有 1200ms 节流
  for (const b of bots) b.send({ type: 'relay_rate', bookIndex: 1, kind: 'veg' });
  await sleep(400);
  const last = host.msgs.filter((m) => m.type === 'relay_rating').pop();
  h.expect(last && last.bookIndex === 1 && last.vegCount === 3, '鲜花/蔬菜计数已广播', JSON.stringify(last));
  bots[2].drop();
  await sleep(200);
  await bots[2].reconnect();
  const after = await bots[2].waitFor('relay_reveal', () => true, 5000).catch(() => null);
  h.expect(!!after, '揭晓阶段重连会补发揭晓数据');
  if (after) {
    h.note(`重连后第 0 本鲜花=${after.books[0]?.flowerCount} 第 1 本蔬菜=${after.books[1]?.vegCount}`);
    h.expect(after.books[0]?.flowerCount === 3, '重连补发的鲜花数应与实时一致', `flowerCount=${after.books[0]?.flowerCount}`);
    h.expect(after.books[1]?.vegCount === 3, '重连补发的蔬菜数应与实时一致', `vegCount=${after.books[1]?.vegCount}`);
  }
});

test('传画-中途加入者获得新本子', async (h) => {
  const { bots, code } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 6 : 30, guessSeconds: h.fast ? 6 : 20 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 3 });
  await bots[0].waitFor('relay_task', (m) => m.kind === 'draw');
  const late1 = await h.bot('迟到1');
  h.expect(!!(await late1.join(code)).player, '作画棒中途加入成功');
  await late1.connect();
  bots.push(late1);
  attachRelayPilot(h, bots);
  await bots[0].waitFor('phase_changed', (m) => m.phase === 'relay_guess', nextMs(h, 15000, 90000));
  const late2 = await h.bot('迟到2');
  h.expect(!!(await late2.join(code)).player, '猜词棒中途加入成功');
  await late2.connect();
  bots.push(late2);
  attachRelayPilot(h, bots);
  const playersMsg = await bots[0].waitFor('players', (m) => m.players.length === 5, 4000);
  h.expect(playersMsg.players.length === 5, '在线玩家列表包含两位加入者');
  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  h.expect(reveal.books.length === 5, '每位加入者新增一本本子', `books=${reveal.books.length}`);
  h.expect(new Set(reveal.books.map((b) => b.id)).size === 5, '本子 id 不重复', reveal.books.map((b) => b.id).join(','));
  h.expect(new Set(reveal.books.map((b) => b.originalWord)).size === 5, '新本子用没出现过的词', reveal.books.map((b) => b.originalWord).join(','));
  checkRelayIntegrity(h, bots, { passes: 3, players: 5, expectBooks: 5 });
  h.note(`两人加入后的揭晓结构：${dumpBooks(reveal)}`);
});

test('传画-加入后环状轮转不撞本', async (h) => {
  const { bots, code } = await makeRoom(h, { players: 4, config: { gameMode: 'relay', relayPasses: 4, drawSeconds: h.fast ? 5 : 30, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots);
  await startRelay(h, bots, { passes: 4 });
  await bots[0].waitFor('relay_task', (m) => m.kind === 'draw');
  const late = await h.bot('迟到');
  await late.join(code);
  await late.connect();
  bots.push(late);
  attachRelayPilot(h, bots);
  await bots[0].waitFor('game_over', () => true, h.fast ? 50000 : 300000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();

  // 任务侧：同一棒里两台设备不应拿到同一本
  const perStep = new Map();
  for (const b of bots) {
    for (const t of b.__relay.tasks) {
      if (!perStep.has(t.step)) perStep.set(t.step, []);
      perStep.get(t.step).push([b.name, t.bookIndex]);
    }
  }
  for (const [step, list] of perStep) {
    const books = list.map((x) => x[1]);
    h.expect(new Set(books).size === books.length, `第 ${step} 棒没有两人拿到同一本`, JSON.stringify(list));
  }

  // 结果侧：每一棒位置上出现的玩家名不应重复（占位记录除外）
  const absent = new Set(['无人作画', '缺席']);
  for (let i = 0; i < 4; i += 1) {
    const names = reveal.books.map((b) => b.entries[i]?.playerName).filter((n) => n && !absent.has(n));
    h.expect(new Set(names).size === names.length, `第 ${i + 1} 棒每本子由不同玩家经手`, names.join(','));
  }
  const joinerSteps = reveal.books.flatMap((b) => b.entries.map((e, i) => (e.playerName === '迟到' ? i + 1 : null))).filter(Boolean);
  h.expect(joinerSteps.length > 0 && new Set(joinerSteps).size === joinerSteps.length, '加入者每一棒只经手一本', JSON.stringify(joinerSteps));
  checkRelayIntegrity(h, bots, { passes: 4, players: 5, expectBooks: 5 });
  h.note(`5 人 4 棒的揭晓结构：${dumpBooks(reveal)}`);
});

test('协议-传画缩略图字符集校验', async (h) => {
  h.expectErrorCodes('not_drawer', 'bad_image');
  const { bots } = await makeRoom(h, { players: 3, config: { gameMode: 'relay', relayPasses: 3, drawSeconds: h.fast ? 6 : 30, guessSeconds: h.fast ? 5 : 15 } });
  attachRelayPilot(h, bots, { upload: 'none' });
  await startRelay(h, bots, { passes: 3 });
  const t = await bots[0].waitFor('relay_task', (m) => m.kind === 'draw');
  await bots[0].waitFor('phase_changed', (m) => m.phase === 'relay_collect', nextMs(h, 20000, 90000));

  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
  const wrapped = `data:image/png;base64,${TINY_PNG.slice('data:image/png;base64,'.length).replace(/(.{20})/g, '$1\n')}`;
  const trailing = `${TINY_PNG}<img src=x onerror=alert(1)>`;
  const gap = h.fast ? 40 : 150; // 全部尝试必须落在同一个收集窗口内（缩放计时下收集窗口只有 400ms）
  const attempts = [
    ['svg', svg],
    ['带换行的 base64', wrapped],
    ['尾部拼 HTML', trailing],
    ['合法 PNG', TINY_PNG],
  ];
  const doneAt = [];
  for (const [, image] of attempts) {
    const base = bots[0].msgs.length;
    bots[0].send({ type: 'relay_upload', bookIndex: t.bookIndex, image });
    await sleep(gap);
    doneAt.push(bots[0].msgs.slice(base).some((m) => m.type === 'relay_upload_done'));
  }
  h.expect(!doneAt[0], 'SVG data URI 被拒绝');
  h.expect(!doneAt[1], 'base64 中夹换行/空白被拒绝（不是纯净 base64）');
  h.expect(!doneAt[2], '尾部拼接 HTML 的缩略图被拒绝');
  h.expect(doneAt[3], '合法 PNG 被接受');
  const errors = bots[0].msgs.filter((m) => m.type === 'error' && m.code === 'bad_image');
  h.expect(errors.length >= 1, '至少有一条 bad_image 回执');
  h.note(`三次非法上传只回执 ${errors.length} 条 bad_image（同码 1500ms 节流）`);

  await bots[0].waitFor('game_over', () => true, h.fast ? 40000 : 300000);
  const reveal = bots[0].msgs.filter((m) => m.type === 'relay_reveal').pop();
  const thumbs = reveal.books.flatMap((b) => b.entries).filter((e) => e.type === 'draw').map((e) => e.thumbnail).filter(Boolean);
  h.expect(thumbs.length === 1 && thumbs[0] === TINY_PNG, '只有合法 PNG 进入揭晓', JSON.stringify(thumbs.map((x) => x.slice(0, 24))));
  h.expect(!thumbs.some((x) => /svg|script|onerror/i.test(x)), '揭晓里的缩略图不含可疑载荷');
});
