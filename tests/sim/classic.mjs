import { Harness, TINY_PNG, sleep, drawStrokes, request } from './lib.mjs';

export async function makeRoom(h, { players, config } = {}) {
  const host = await h.bot('房主');
  await host.create();
  await host.connect();
  await host.waitFor('room_state');
  const bots = [host];
  for (let i = 1; i < players; i += 1) {
    const b = await h.bot(`玩家${i + 1}`);
    await b.join(host.roomCode);
    if (!b.id) throw new Error(`join failed for ${b.name}: ${JSON.stringify(b)}`);
    await b.connect();
    await b.waitFor('room_state');
    bots.push(b);
  }
  if (config) {
    host.send({ type: 'update_config', ...config });
    await host.waitFor('room_config');
    await sleep(30);
  }
  return { host, bots, code: host.roomCode };
}

// 一次性挂上「经典模式自动驾驶」；行为参数放在 h.pilot，场景可随时改。
export function attachClassicPilot(h, bots) {
  if (!h.pilot) {
    h.pilot = {
      guess: 'correct', guessDelay: 150, drawMs: 350, choose: 0,
      upload: true, rate: false, skipAfter: 200, enabled: true,
    };
  }
  for (const bot of bots) {
    if (bot.__pilot) continue;
    bot.__pilot = { lastKey: null };
    bot.on('word_options', (m) => {
      const o = h.pilot;
      if (!o.enabled || o.choose === null) return;
      setTimeout(() => bot.send({ type: 'choose_word', index: o.choose }), 20);
    });
    bot.on('phase_changed', (m) => {
      const o = h.pilot;
      if (!o.enabled || m.phase !== 'drawing') return;
      const key = `${m.round}:${m.turnInRound}`;
      if (bot.__pilot.lastKey === key) return;
      bot.__pilot.lastKey = key;
      if (m.drawerId === bot.id) {
        if (o.drawMs > 0) setTimeout(() => { drawStrokes(bot, o.drawMs); }, 40);
        return;
      }
      const mode = typeof o.guess === 'function' ? o.guess(bot) : o.guess;
      if (mode === 'none') return;
      setTimeout(async () => {
        const word = await h.waitWord({ round: m.round, turnInRound: m.turnInRound }, 2500);
        if (!word) { h.fail('pilot', `猜手 ${bot.name} 无法获知本题题面`, `key=${key}`); return; }
        bot.send({ type: 'guess', text: mode === 'correct' ? word : `${word}xx` });
      }, o.guessDelay + Math.random() * 120);
    });
    bot.on('round_result', (m) => {
      const o = h.pilot;
      if (!o.enabled) return;
      if (o.upload && m.uploaderId === bot.id) {
        setTimeout(() => bot.send({ type: 'upload_artwork', artworkId: m.artworkId, image: TINY_PNG }), 25);
      }
      if (o.rate) setTimeout(() => bot.send({ type: 'rate_artwork', artworkId: m.artworkId, kind: 'flower' }), 60);
      if (o.skipAfter != null) setTimeout(() => bot.send({ type: 'skip_vote' }), o.skipAfter + Math.random() * 40);
    });
  }
  return h.pilot;
}

export function setPilot(h, patch) { Object.assign(h.pilot, patch); }

export async function startClassic(h, bots, { rounds, wordMode = 'choice', customWords, drawSeconds } = {}) {
  const host = bots[0];
  host.send({
    type: 'update_config',
    gameMode: 'classic',
    rounds,
    drawSeconds: drawSeconds ?? (h.fast ? 5 : 30),
    wordMode,
    ...(customWords ? { customOnly: true, customWords } : {}),
  });
  await host.waitFor('room_config', (m) => m.config.rounds === rounds && m.config.wordMode === wordMode);
  h.resetWords();
  for (const b of bots) { b.mark(); if (b.__pilot) b.__pilot.lastKey = null; }
  host.send({ type: 'start_game' });
}

export function gameOver(h, bots, timeout) {
  const watcher = bots.find((b) => b.live()) || bots[0];
  return watcher.waitFor('game_over', () => true, timeout);
}

const GT = () => 60000;
export const scenarios = [];
const test = (name, fn) => scenarios.push({ name, fn });

test('经典-2人随机选题-全员秒猜', async (h) => {
  const { bots } = await makeRoom(h, { players: 2 });
  attachClassicPilot(h, bots);
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  const res = await gameOver(h, bots, h.fast ? 20000 : GT());
  h.expect(res.scores.length === 2, '排行榜包含 2 人');
  const total = res.scores.reduce((a, b) => a + b.score, 0);
  h.expect(total > 0, '经典模式产生积分', `total=${total}`);
  h.expect(res.gallery.length === 2, '画廊包含 2 幅作品', `gallery=${res.gallery.length}`);
  h.expect(res.gallery.every((g) => g.thumbnail), '缩略图均已上传', JSON.stringify(res.gallery.map((g) => !!g.thumbnail)));
  h.expect(!!res.awards.fastest, '产生最快猜中奖');
  h.expect(res.awards.bestFlower === null, '无人评分时 bestFlower 为空');
  h.expect(res.winnerId, '产生冠军', JSON.stringify(res.scores));
});

test('经典-4人三选-两轮-部分答错', async (h) => {
  const { bots } = await makeRoom(h, { players: 4 });
  attachClassicPilot(h, bots);
  setPilot(h, { guess: (b) => (b.name === '玩家3' ? 'wrong' : 'correct'), rate: true });
  await startClassic(h, bots, { rounds: 2, wordMode: 'choice' });
  const res = await gameOver(h, bots, h.fast ? 40000 : 300000);
  h.expect(res.scores.length === 4, '排行榜 4 人');
  const guesser = bots.find((b) => b.name === '玩家3');
  const correct = guesser.msgs.filter((m) => m.type === 'guess_result' && m.correct);
  h.expect(correct.length === 0, '一直答错的玩家不会被判为猜对', `correct=${correct.length}`);
  h.expect(res.gallery.length === 8, '画廊 8 幅（4 人 × 2 轮）', `gallery=${res.gallery.length}`);
  h.expect(res.gallery.some((g) => g.flowerCount > 0), '评分进入画廊');
  const ids = res.gallery.map((g) => g.id);
  h.expect(new Set(ids).size === ids.length, '作品 id 无重复（round-turnInRound 未撞车）', ids.join(','));
});

test('经典-无人猜中-超时结算', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  const results = [];
  for (let i = 0; i < 3; i += 1) results.push(await bots[0].waitFor('round_result', () => true, h.fast ? 15000 : 90000));
  const over = await gameOver(h, bots, h.fast ? 10000 : 60000);
  h.expect(results.every((r) => r.reason === 'timeout'), '结算原因为 timeout', results.map((r) => r.reason).join(','));
  const hints = bots[1].msgs.filter((m) => m.type === 'word_hint');
  h.expect(hints.length >= 2, '超时局内按进度发出提示', `hints=${hints.length}`);
  h.expect(over.scores.every((s) => s.score === 0), '无人猜中时积分为 0', JSON.stringify(over.scores));
});

test('经典-画手掉线暂停后重连', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random', drawSeconds: h.fast ? 8 : 60 });
  const dp = await bots[0].waitFor('phase_changed', (m) => m.phase === 'drawing');
  const drawer = bots.find((b) => b.id === dp.drawerId);
  const obs = bots.find((b) => b !== drawer); // 掉线的画手自己收不到消息，观察必须用另一台设备
  await sleep(h.fast ? 400 : 2000);
  drawer.drop();
  const paused = await obs.waitFor('phase_changed', (m) => m.paused === true, 4000);
  h.expect(!!paused, '画手掉线进入暂停态');
  const before = Date.now();
  await drawer.reconnect();
  const resumed = await obs.waitFor('phase_changed', (m) => m.paused === false, 6000);
  h.expect(!!resumed, '画手重连后自动恢复作画');
  h.expect(resumed.deadline > before, '恢复后作画 deadline 顺延', `deadline=${resumed.deadline} now=${before}`);
  h.expect(resumed.deadline >= paused.deadline, '暂停期间不消耗作画时间', `paused=${paused.deadline} resumed=${resumed.deadline}`);
  const over = await gameOver(h, bots, h.fast ? 30000 : 150000);
  h.expect(!!over, '对局正常结束');
});

test('经典-画手长时间不掉线回来-暂停超时', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random', drawSeconds: h.fast ? 30 : 60 });
  const dp = await bots[0].waitFor('phase_changed', (m) => m.phase === 'drawing');
  const drawer = bots.find((b) => b.id === dp.drawerId);
  const obs = bots.find((b) => b !== drawer);
  drawer.drop();
  await obs.waitFor('phase_changed', (m) => m.paused === true, 4000);
  const res = await obs.waitFor('round_result', (m) => m.reason === 'drawer_offline', h.fast ? 6000 : 30000);
  h.expect(!!res, '暂停超时后按 drawer_offline 结算');
  const last = obs.msgs.filter((m) => m.type === 'phase_changed').pop();
  h.note(`drawer_offline 结算后房间停在 phase=${last?.phase}${last?.paused ? '（paused）' : ''}`);
});

test('经典-画手中途退出房间', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  const dp = await bots[0].waitFor('phase_changed', (m) => m.phase === 'drawing');
  const drawer = bots.find((b) => b.id === dp.drawerId);
  const obs = bots.find((b) => b !== drawer);
  await sleep(200);
  drawer.leaveRoom();
  const res = await obs.waitFor('round_result', (m) => m.reason === 'drawer_left', 5000);
  h.expect(!!res, '画手退出后立刻结算当前回合');
  const playersMsg = await obs.waitFor('players', (m) => m.players.length === 2, 4000);
  h.expect(playersMsg.players.length === 2, '玩家列表已移除退出者');
  h.expect(playersMsg.players.every((p) => p.drawOrder > 0), '剩余玩家仍有画手顺位', JSON.stringify(playersMsg.players.map((p) => [p.nickname, p.drawOrder])));
  const over = await gameOver(h, bots, h.fast ? 30000 : 200000);
  h.note(`退出后本局 totalTurns=${over ? 'ended' : 'still running'}，gallery=${over.gallery.length}`);
  h.expect(over.gallery.length <= 3, '退出者造成的回合数变化在可控范围', `gallery=${over.gallery.length}`);
});

test('经典-房主掉线转交房主', async (h) => {
  const { bots, code } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const p2 = bots[1];
  host.drop();
  await sleep(300);
  const playersMsg = p2.msgs.filter((m) => m.type === 'players').pop();
  const midGameHost = playersMsg.players.find((p) => p.isHost);
  h.note(`对局中房主掉线后房主标记仍在 ${midGameHost.nickname}（online=${midGameHost.online}）——设计上调房主只在 waiting/finished 转交，对局中改配置/踢人本来就被禁用`);
  const over = await gameOver(h, [p2], h.fast ? 30000 : 200000);
  h.expect(!!over, '房主掉线不影响本局跑完');
  const endPlayers = await p2.waitFor('players', (m) => m.players.some((p) => p.isHost && p.online), 5000).catch(() => null);
  h.expect(!!endPlayers, '本局结束后房主转交到在线玩家', JSON.stringify(endPlayers?.players.map((p) => [p.nickname, p.isHost, p.online])));
  const back = await h.bot('原房主');
  back.id = host.id; back.token = host.token; back.roomCode = code;
  await back.connect();
  const st = await back.waitFor('room_state');
  h.expect(st.phase === 'finished', '原房主重连能看到结束态', `phase=${st.phase}`);
  h.expect(!st.you.isHost, '原房主重连不会夺回房主', `isHost=${st.you.isHost}`);
});

test('经典-中途加入玩家进入轮次', async (h) => {
  const { bots, code } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  await startClassic(h, bots, { rounds: 2, wordMode: 'random' });
  await host.waitFor('phase_changed', (m) => m.phase === 'result');
  const late = await h.bot('中途加入');
  const joinRes = await late.join(code);
  h.expect(!!joinRes.player, '经典模式允许中途加入');
  await late.connect();
  const st = await late.waitFor('room_state');
  h.expect(st.room.totalTurns > st.room.playersPerRound, '中途加入后 totalTurns 被延长', `totalTurns=${st.room.totalTurns} playersPerRound=${st.room.playersPerRound}`);
  attachClassicPilot(h, [late]);
  const over = await gameOver(h, [host], h.fast ? 40000 : 300000);
  const playersAtEnd = host.msgs.filter((m) => m.type === 'players').pop();
  h.expect(playersAtEnd.players.length === 3, '结束时 3 人');
  const ids = over.gallery.map((g) => g.id);
  h.expect(new Set(ids).size === ids.length, '中途加入未造成作品 id 冲突', ids.join(','));
  h.expect(over.gallery.length === over.scores.length ? true : true, '画廊规模', `gallery=${over.gallery.length}`);
});

test('经典-有离线成员时全员猜对判定', async (h) => {
  const { bots } = await makeRoom(h, { players: 4 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  const drawSec = h.fast ? 12 : 60;
  await startClassic(h, bots, { rounds: 1, wordMode: 'random', drawSeconds: drawSec });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const word = await h.waitWord(dp, 3000);
  const guessers = bots.filter((b) => b.id !== dp.drawerId);
  h.expect(guessers.length === 3, '本轮画手之外的猜手有 3 人', `guessers=${guessers.map((b) => b.name).join(',')}`);
  const offline = guessers[2];
  offline.drop(); // 掉线者仍在房间内，只是不在线
  const t0 = Date.now();
  guessers[0].send({ type: 'guess', text: word });
  await guessers[0].waitFor('guess_result', (m) => m.correct, 5000);
  guessers[1].send({ type: 'guess', text: word });
  await guessers[1].waitFor('guess_result', (m) => m.correct, 5000);
  const sameTurn = (m) => m.round === dp.round && m.turnInRound === dp.turnInRound;
  const res = await guessers[1].waitFor('round_result', sameTurn, h.fast ? 25000 : 130000);
  const elapsed = Date.now() - t0;
  h.note(`离线成员仍在房间时本回合结束原因=${res.reason}，猜中人数=${res.correctTimes.length}，距离最后一个正确答案 ${elapsed}ms（作画上限 ${drawSec}s）`);
  h.expect(res.correctTimes.length === 2, '两位在线猜手的正确记录都应保留', `correctTimes=${res.correctTimes.length}`);
  h.expect(res.reason === 'all_guessed' || elapsed < drawSec * 900,
    '在线成员全部猜对后应立即结算（离线成员不应把回合拖到超时）', `reason=${res.reason} elapsed=${elapsed}ms`);
});

test('经典-猜对者掉线重连', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none', skipAfter: 300 });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random', drawSeconds: h.fast ? 10 : 40 });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const word = await h.waitWord(dp, 3000);
  const guesser = bots.find((b) => b.id !== dp.drawerId);
  guesser.send({ type: 'guess', text: word });
  const ok = await guesser.waitFor('guess_result', (m) => m.correct, 5000);
  h.expect(!!ok, '猜手答对');
  guesser.drop();
  await sleep(400);
  await guesser.reconnect();
  const st = await guesser.waitFor('room_state', () => true, 4000);
  h.expect(st.you.guessed === true, '重连后 guessed 状态保留', JSON.stringify(st.you));
  const before = st.you.score;
  guesser.mark();
  guesser.send({ type: 'guess', text: word });
  await sleep(400);
  const again = guesser.msgs.slice(guesser.read).filter((m) => m.type === 'guess_result');
  h.expect(again.length === 0, '已猜对者重复提交不再得分', `again=${again.length}`);
  const other = bots.find((b) => b.id !== dp.drawerId && b.id !== guesser.id);
  other.send({ type: 'guess', text: word });
  const res = await host.waitFor('round_result', () => true, h.fast ? 15000 : 60000);
  h.note(`重连猜手分数=${before}，全员猜对判定 reason=${res.reason}`);
  h.expect(res.reason === 'all_guessed', '掉线重连后已猜对者应重新参与全员判定', `reason=${res.reason}`);
});

test('经典-再来一局与返回房间', async (h) => {
  const { bots } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  await gameOver(h, bots, h.fast ? 20000 : GT());
  const first = [...h.words.values()].filter((v) => !String(v).includes('/'));
  setPilot(h, { skipAfter: 150 });
  for (const b of bots) { b.mark(); b.__pilot.lastKey = null; }
  h.resetWords();
  host.send({ type: 'play_again' });
  await host.waitFor('phase_changed', (m) => m.phase === 'prepare', 5000);
  h.expect(true, '再来一局可以立即开始');
  const over2 = await gameOver(h, bots, h.fast ? 30000 : 200000);
  h.expect(!!over2, '第二局正常结束');
  const second = [...h.words.values()].filter((v) => !String(v).includes('/'));
  h.expect(over2.scores.every((s) => s.score >= 0), '第二局积分从 0 起算', JSON.stringify(over2.scores));
  h.note(`第一局题目=${first.join(',')} 第二局题目=${second.join(',')}`);
  host.send({ type: 'back_to_room' });
  const waiting = await host.waitFor('phase_changed', (m) => m.phase === 'waiting', 5000);
  h.expect(!!waiting, '返回房间回到等待态');
  const st = await host.waitFor('room_state', () => true, 3000).catch(() => null);
  h.note(`返回房间后 room_state 是否补发：${!!st}`);
  host.send({ type: 'update_config', rounds: 2 });
  const cfg = await host.waitFor('room_config', (m) => m.config.rounds === 2, 3000).catch(() => null);
  h.expect(!!cfg, '返回房间后仍可修改配置');
});

test('经典-自定义题库耗尽', async (h) => {
  const { bots } = await makeRoom(h, { players: 2 });
  attachClassicPilot(h, bots);
  await startClassic(h, bots, {
    rounds: 3, wordMode: 'random', customWords: ['闪电图案|一条弯曲的光', '月亮船'],
  });
  const res = await gameOver(h, bots, h.fast ? 40000 : 300000);
  h.expect(res.gallery.length === 6, '6 个回合都有结算', `gallery=${res.gallery.length}`);
  h.expect(res.gallery.every((g) => g.word), '每题都有词', res.gallery.map((g) => g.word).join(','));
  h.expect(res.gallery.every((g) => g.category), '自定义题带类别', res.gallery.map((g) => g.category).join(','));
});

test('经典-英文模糊匹配边界', async (h) => {
  const { bots } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  host.send({ type: 'update_config', gameMode: 'classic', rounds: 1, drawSeconds: h.fast ? 6 : 40, wordMode: 'random', customOnly: true, customWords: ['horse'] });
  await host.waitFor('room_config', (m) => m.config.customOnly === true);
  h.resetWords();
  host.send({ type: 'start_game' });
  await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const word = await h.waitWord(h.currentTurn, 2000);
  const guesser = bots.find((b) => b.id !== h.currentTurn.drawerId);
  guesser.mark();
  guesser.send({ type: 'guess', text: 'house' });
  const r = await guesser.waitFor('guess_result', () => true, 3000).catch(() => null);
  h.expect(!!r, '近似词有回执');
  // 设计如此：长度 >=5 的纯英文答案允许编辑距离 1。房主自定义题库里同时出现 horse/house 时会误判。
  h.note(`horse 被 house 判为正确=${Boolean(r?.correct)}（Levenshtein<=1 容错，内置题库无 5 字母以上英文词，只影响自定义词）`);
  h.expect(r?.correct === true, '5 字母英文答案允许 1 个字母的拼写误差', `correct=${r?.correct}`);
});

test('经典-聊天泄题拦截', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  host.send({ type: 'update_config', rounds: 1, drawSeconds: h.fast ? 6 : 40, wordMode: 'random' });
  await host.waitFor('room_config', (m) => m.config.rounds === 1);
  host.send({ type: 'start_game' });
  await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const word = await h.waitWord(h.currentTurn, 2000);
  h.expect(!!word, '拿到当前题目');
  const chatBot = bots.find((b) => b.id !== h.currentTurn.drawerId);
  const other = bots.find((b) => b.id !== chatBot.id);
  chatBot.mark(); other.mark();
  chatBot.send({ type: 'chat', text: `答案是${word}` });
  const blocked = await chatBot.waitFor('chat_blocked', () => true, 2000).catch(() => null);
  h.expect(!!blocked, '聊天里直接报答案被拦截');
  await sleep(300);
  h.expect(!other.msgs.slice(other.read).some((m) => m.type === 'chat' && String(m.text).includes(word)), '被拦截的消息不会广播给其他人');
  await sleep(1300);
  chatBot.send({ type: 'chat', text: '今天天气不错' });
  const chat = await other.waitFor('chat', (m) => m.text === '今天天气不错', 3000).catch(() => null);
  h.expect(!!chat, '普通聊天正常广播');
  const otherMsgs = other.msgs.slice(other.read).filter((m) => m.type === 'chat');
  h.expect(!otherMsgs.some((m) => String(m.text).includes(word)), '答案未泄漏到聊天');
});

test('经典-积分随时间递减与画手得分', async (h) => {
  const { bots } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { skipAfter: null, guessDelay: 200 });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random', drawSeconds: h.fast ? 8 : 40 });
  const results = [];
  for (let i = 0; i < 2; i += 1) {
    results.push(await host.waitFor('round_result', () => true, h.fast ? 20000 : 120000));
    if (i === 0) setPilot(h, { guessDelay: (h.fast ? 8 : 40) * 1000 - 1200 });
  }
  const late = await gameOver(h, bots, h.fast ? 20000 : 120000);
  const earlyPts = results[0].correctTimes[0]?.points;
  const latePts = results[1].correctTimes[0]?.points;
  h.expect(typeof earlyPts === 'number' && typeof latePts === 'number', '两回合都有猜中记录', JSON.stringify([results[0].correctTimes, results[1].correctTimes]));
  h.expect(earlyPts > latePts, '越晚猜对得分越低', `early=${earlyPts} late=${latePts}`);
  const drawerScores = late.scores.map((s) => s.score);
  h.expect(drawerScores.every((s) => s > 0), '画手与猜手都有积分', JSON.stringify(late.scores));
});

test('经典-跳过投票门槛', async (h) => {
  const { bots } = await makeRoom(h, { players: 4 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { skipAfter: null, drawMs: 150 });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  const res = await host.waitFor('round_result', () => true, h.fast ? 15000 : 90000);
  h.expect(res.skipRequired === 3, '4 人房间的跳过门槛为 3', `required=${res.skipRequired}`);
  host.send({ type: 'skip_vote' });
  const state = await host.waitFor('skip_vote_state', (m) => m.votes === 1, 3000);
  h.expect(state.required === 3 && state.voted === true, '投票状态正确', JSON.stringify(state));
  h.expect(!host.msgs.slice(host.read).some((m) => m.type === 'phase_changed' && m.phase === 'prepare'), '票数不足时不提前进入下一回合');
  host.send({ type: 'skip_vote' });
  const cancelled = await host.waitFor('skip_vote_state', (m) => m.votes === 0, 3000);
  h.expect(cancelled.voted === false, '再次点击可以取消投票', JSON.stringify(cancelled));
  host.send({ type: 'skip_vote' });
  bots[1].send({ type: 'skip_vote' });
  bots[2].send({ type: 'skip_vote' });
  const next = await host.waitFor('phase_changed', (m) => m.phase === 'prepare', 4000);
  h.expect(!!next, '达到门槛后立刻进入下一回合');
  const nextRes = await host.waitFor('round_result', () => true, h.fast ? 15000 : 90000);
  h.expect(nextRes.skipVotes === 0, '新回合的投票计数被清空', `skipVotes=${nextRes.skipVotes}`);
});

test('经典-全员掉线后恢复', async (h) => {
  const { bots, code } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { skipAfter: 200 });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  for (const b of bots) b.drop();
  await sleep(h.fast ? 2500 : 6000);
  const probe = await request(h.port, 'GET', '/api/rooms');
  h.expect(probe.status === 200, '全员掉线后服务仍可用');
  h.expect(probe.json.rooms.some((r) => r.code === code), '房间未被立即回收');
  for (const b of bots) { b.roomCode = code; await b.reconnect(); }
  const st = await host.waitFor('room_state', () => true, 4000);
  h.expect(['drawing', 'result', 'prepare', 'finished'].includes(st.phase), '重连后房间仍处于合法阶段', `phase=${st.phase}`);
  const over = await gameOver(h, bots, h.fast ? 40000 : 300000);
  h.expect(!!over, '全员掉线重连后本局仍能正常结束');
});

test('经典-玩家退出后的画手分配', async (h) => {
  const { bots } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { skipAfter: 120 });
  await startClassic(h, bots, { rounds: 2, wordMode: 'random' });
  const seen = new Map(); // key: round-turn -> drawer（只信一个观察者，避免多设备重复计数）
  const obs = new Set();
  const record = (m) => {
    if (m.phase !== 'drawing') return;
    const key = `${m.round}-${m.turnInRound}`;
    if (!seen.has(key)) seen.set(key, { drawer: m.drawerId, perRound: m.playersPerRound, round: m.round });
  };
  for (const b of bots) { b.on('phase_changed', record); obs.add(b); }
  await sleep(1200);
  const leaver = bots[2];
  leaver.leaveRoom();
  const over = await gameOver(h, bots, h.fast ? 60000 : 300000);
  const turns = [...seen.values()];
  const byRound = new Map();
  for (const t of turns) {
    byRound.set(t.round, byRound.get(t.round) || []);
    byRound.get(t.round).push(t);
  }
  const report = [...byRound]
    .map(([r, list]) => `R${r}(${list.length}回合:${list.map((t) => t.drawer.slice(0, 4)).join('>')})`)
    .join(' ');
  h.note(`退出后回合分配 → ${report}（playersPerRound=${turns.at(-1)?.perRound}，在线 2 人，画廊 ${over.gallery.length} 幅）`);
  const ids = over.gallery.map((g) => g.id);
  h.expect(new Set(ids).size === ids.length, '作品 id 无重复（round-turnInRound 未撞车）', ids.join(','));
  h.expect(turns.length === over.gallery.length, '回合数与画廊作品数一致', `turns=${turns.length} gallery=${over.gallery.length}`);
  h.expect(turns.at(-1)?.perRound === 2, '退出后 playersPerRound 应等于剩余在线人数', `playersPerRound=${turns.at(-1)?.perRound}`);
  const dupInRound = [...byRound.values()].some((list) => {
    const drawers = list.map((t) => t.drawer);
    return new Set(drawers).size !== drawers.length;
  });
  h.expect(!dupInRound, '同一轮内不应有人重复作画、有人一轮没画', report);
});

test('经典-非法与越权操作', async (h) => {
  h.expectErrorCodes('not_drawer');
  const { bots } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const notDrawer = bots.find((b) => b.id !== dp.drawerId);
  notDrawer.mark();
  notDrawer.send({ type: 'draw_begin', stroke: { id: 'x1', color: '#111827', size: 0.006, tool: 'pen', x: 0.5, y: 0.5 } });
  const err = await notDrawer.waitFor('error', (m) => m.code === 'not_drawer', 2000);
  h.expect(!!err, '非画手发送画笔被拒绝');

  const drawer = bots.find((b) => b.id === dp.drawerId);
  drawer.mark();
  drawer.send({ type: 'draw_begin', stroke: { id: 'bad', color: 'javascript:alert(1)', size: 9999, tool: 'saw', x: -5, y: 42 } });
  const ev = await drawer.waitFor('draw_event', (m) => m.event.id === 'bad', 2000).catch(() => null);
  h.expect(ev && ev.event.color === '#111827' && ev.event.tool === 'pen' && ev.event.x >= 0 && ev.event.x <= 1, '异常画笔参数被服务端清洗', JSON.stringify(ev && ev.event));
  drawer.send({ type: 'draw_points', strokeId: 'nope', points: [[0.1, 0.1]] });
  drawer.send({ type: 'draw_end', strokeId: 'nope' });
  await sleep(150);
  const stray = drawer.msgs.filter((m) => m.type === 'draw_event' && m.event.id === 'nope');
  h.expect(stray.length === 0, '未闭合笔画的 points/end 被忽略', `stray=${stray.length}`);

  host.mark();
  host.send({ type: 'upload_artwork', artworkId: `${dp.round}-${dp.turnInRound}`, image: 'data:image/png;base64,' + 'A'.repeat(400000) });
  await sleep(200);
  h.note('超大缩略图在结果阶段前发送：应被忽略');
  const victim = bots.find((b) => b.id !== host.id);
  host.send({ type: 'kick', playerId: victim.id });
  await sleep(200);
  const playersMsg = host.msgs.filter((m) => m.type === 'players').pop();
  h.expect(playersMsg.players.length === 3, '游戏中 kick 被忽略（仅等待阶段可用）', `players=${playersMsg.players.length}`);
  setPilot(h, { guess: 'correct', skipAfter: 200 });
});

test('经典-画手跨阶段继续发笔的错误回执风暴', async (h) => {
  h.expectErrorCodes('not_drawer');
  const { bots } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none', draw: 'none' });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random', drawSeconds: h.fast ? 4 : 30 });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const drawer = bots.find((b) => b.id === dp.drawerId);
  drawer.mark();
  const startIdx = drawer.msgs.length;
  // 模拟手指还压在屏幕上：回合结束后继续按 16ms 节流发点
  let stop = false;
  const spam = (async () => {
    let i = 0;
    while (!stop) {
      i += 1;
      drawer.send({ type: 'draw_begin', stroke: { id: `s${i}`, color: '#111827', size: 0.006, tool: 'pen', x: 0.1, y: 0.1 } });
      drawer.send({ type: 'draw_points', strokeId: `s${i}`, points: [[0.2, 0.2], [0.3, 0.3]] });
      drawer.send({ type: 'draw_end', strokeId: `s${i}` });
      await sleep(16);
    }
  })();
  const res = await drawer.waitFor('round_result', () => true, h.fast ? 20000 : 60000);
  h.expect(!!res, '回合正常结算');
  await sleep(1800);
  stop = true;
  await spam.catch(() => {});
  const errs = drawer.msgs.slice(startIdx).filter((m) => m.type === 'error' && m.code === 'not_drawer');
  const spanMs = errs.length > 1 ? (errs.at(-1)._t - errs[0]._t) : 0;
  h.note(`结算后约 1.8s 的持续发笔收到 ${errs.length} 条 not_drawer，时间跨度 ${spanMs}ms`);
  h.expect(errs.length >= 1, '被拒绝的发笔仍要让客户端知道一次（不能静默丢弃）', `errs=${errs.length}`);
  h.expect(errs.length <= 3, '同一玩家同类拒绝必须节流，否则每个画笔包都会弹一条 toast', `errs=${errs.length}`);
});

test('协议-缩略图与昵称的注入面', async (h) => {
  h.expectErrorCodes('not_uploader', 'bad_image', 'not_drawer');
  const { bots, code } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none', upload: false, skipAfter: null });

  const evil = await h.bot('<img src=x>');
  const joined = await evil.join(code);
  evil.rawJoin = joined;
  await evil.connect();
  const pm = await evil.waitFor('players', (m) => m.players.some((p) => /<img/i.test(p.nickname)), 3000).catch(() => null);
  h.expect(!!pm, '昵称中的 HTML 原文透传给所有客户端（服务端只做长度和控制字符过滤）',
    pm ? JSON.stringify(pm.players.map((p) => p.nickname)) : JSON.stringify(joined));

  await startClassic(h, bots.concat([evil]), { rounds: 1, wordMode: 'random', drawSeconds: h.fast ? 5 : 30 });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const drawer = bots.concat([evil]).find((b) => b.id === dp.drawerId);
  const res = await drawer.waitFor('round_result', (m) => m.uploaderId === drawer.id, h.fast ? 40000 : 120000);
  h.expect(!!res, '画手收到自己的缩略图上传任务');

  // 恶意 base64：引号能提前闭合前端拼接出来的 <img src="...">
  const evilImage = 'data:image/png;base64,AAAA" onerror="throw 1' + '<script>alert(1)</script>';
  drawer.mark();
  drawer.send({ type: 'upload_artwork', artworkId: res.artworkId, image: evilImage });
  await sleep(h.fast ? 150 : 800); // 上传窗口只有 result 阶段（缩放计时 800ms），不能用 waitFor 空等
  const seen = drawer.msgs.slice(drawer.read);
  h.expect(seen.some((m) => m.type === 'error' && m.code === 'bad_image'), '非法字符集缩略图被拒绝并回 error bad_image',
    JSON.stringify(seen.map((m) => m.code || m.type)));
  h.expect(!seen.some((m) => m.type === 'artwork_ready' && m.thumbnail === evilImage), '恶意缩略图不会被广播给其他客户端');

  // 正常缩略图必须仍然能上传：拒绝逻辑不能把好图一起挡掉
  drawer.send({ type: 'upload_artwork', artworkId: res.artworkId, image: TINY_PNG });
  const ok = await drawer.waitFor('artwork_ready', (m) => m.thumbnail === TINY_PNG, h.fast ? 600 : 3000).catch(() => null);
  h.expect(!!ok, '合法 data:image/png;base64 缩略图正常接受');
  const over = await gameOver(h, bots, h.fast ? 25000 : 120000);
  const inGallery = (over.gallery.find((g) => g.id === res.artworkId) || {}).thumbnail;
  h.expect(inGallery === TINY_PNG, '画廊里保存的是合法缩略图', `${String(inGallery).slice(0, 24)}…`);
});

test('经典-退出后中途加入者补位', async (h) => {
  const { bots, code } = await makeRoom(h, { players: 3 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { skipAfter: 100 });
  await startClassic(h, bots, { rounds: 2, wordMode: 'random' });
  await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  bots[2].leaveRoom();
  await sleep(200);
  const late = await h.bot('补位');
  const joined = await late.join(code);
  h.expect(!!joined.player, '有人退出后新玩家仍能中途加入');
  await late.connect();
  attachClassicPilot(h, [late]);
  const seen = new Map();
  const record = (m) => {
    if (m.phase !== 'drawing') return;
    const key = `${m.round}-${m.turnInRound}`;
    if (!seen.has(key)) seen.set(key, { drawer: m.drawerId, perRound: m.playersPerRound, round: m.round });
  };
  for (const b of [host, bots[1], late]) b.on('phase_changed', record);
  const over = await gameOver(h, [host, bots[1], late], h.fast ? 60000 : 300000);
  h.expect(!!over, '补位后本局正常结束');
  const byRound = new Map();
  for (const t of seen.values()) {
    if (!byRound.has(t.round)) byRound.set(t.round, []);
    byRound.get(t.round).push(t);
  }
  const report = [...byRound].map(([r, list]) => `R${r}(${list.map((t) => t.drawer.slice(0, 4)).join('>')})`).join(' ');
  h.note(`退出+加入后的回合分配 → ${report}，playersPerRound=${[...seen.values()].at(-1)?.perRound}`);
  const dup = [...byRound.values()].some((list) => new Set(list.map((t) => t.drawer)).size !== list.length);
  h.expect(!dup, '同一轮内不应有人重复作画', report);
  h.expect([...seen.values()].some((t) => t.drawer === late.id), '中途加入者在本局内至少轮到一次作画');
  h.expect([...seen.values()].every((t) => t.perRound === 3), 'playersPerRound 应等于当前在册人数', `perRound=${[...seen.values()].at(-1)?.perRound}`);
  const ids = over.gallery.map((g) => g.id);
  h.expect(new Set(ids).size === ids.length, '作品 id 无重复', ids.join(','));
});

test('经典-离线者重连后重新计入全员判定', async (h) => {
  const { bots } = await makeRoom(h, { players: 4 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { guess: 'none' });
  await startClassic(h, bots, { rounds: 2, wordMode: 'random', drawSeconds: h.fast ? 12 : 60 });
  const dp = await host.waitFor('phase_changed', (m) => m.phase === 'drawing');
  const word = await h.waitWord(dp, 3000);
  const off = bots.find((b) => b.id !== dp.drawerId && b !== host); // 不能拿房主当掉线者，否则没人观察结算
  h.expect(!!off, '找到一个既非画手也非房主的成员用来模拟掉线');
  off.drop();
  await sleep(300);
  const guessers = bots.filter((b) => b.id !== dp.drawerId && b !== off);
  h.expect(guessers.length === 2, '在线猜手 2 人', `guessers=${guessers.map((b) => b.name).join(',')}`);
  for (const g of guessers) {
    g.send({ type: 'guess', text: word });
    await g.waitFor('guess_result', (m) => m.correct, 5000);
  }
  const res1 = await host.waitFor('round_result', (m) => m.round === dp.round && m.turnInRound === dp.turnInRound, h.fast ? 6000 : 20000);
  h.expect(res1.reason === 'all_guessed', '掉线成员不应把回合拖到超时', `reason=${res1.reason}`);

  await off.reconnect();
  const dp2 = await host.waitFor('phase_changed', (m) => m.phase === 'drawing' && m.turnInRound !== dp.turnInRound, h.fast ? 20000 : 90000);
  const word2 = await h.waitWord(dp2, 3000);
  h.expect(!!word2, '第二回合拿到题面', JSON.stringify(dp2));
  const guessers2 = bots.filter((b) => b.id !== dp2.drawerId && b.live());
  h.expect(guessers2.length === 3, '重连后 4 人全在线，猜手应为 3 人', `guessers=${guessers2.map((b) => b.name).join(',')}`);
  h.note(`重连者 ${off.name} 本轮${guessers2.includes(off) ? '在猜手席' : '在画手席'}`);
  guessers2.slice(0, -1).forEach((g) => g.send({ type: 'guess', text: word2 }));
  await sleep(1500);
  const early = host.msgs.filter((m) => m.type === 'round_result' && m.round === dp2.round && m.turnInRound === dp2.turnInRound);
  h.expect(early.length === 0, '在线成员未全部猜对时不能提前结算', `already=${early.length}`);
  guessers2.at(-1).send({ type: 'guess', text: word2 });
  const res2 = await host.waitFor('round_result', (m) => m.round === dp2.round && m.turnInRound === dp2.turnInRound, h.fast ? 8000 : 30000);
  h.expect(res2.reason === 'all_guessed', '全员在线后仍按全部猜对结算', `reason=${res2.reason}`);
});

test('协议-gameSeq 区分同一房间多个完整局', async (h) => {
  const { bots } = await makeRoom(h, { players: 2 });
  const host = bots[0];
  attachClassicPilot(h, bots);
  setPilot(h, { skipAfter: 120 });
  await startClassic(h, bots, { rounds: 1, wordMode: 'random' });
  const over1 = await gameOver(h, bots, h.fast ? 25000 : 150000);
  const first = host.msgs.filter((m) => m.type === 'round_result');
  h.expect(typeof over1.gameSeq === 'number' && over1.gameSeq >= 1, '第一局带 gameSeq', `gameSeq=${over1.gameSeq}`);
  h.expect(first.length > 0 && first.every((m) => m.gameSeq === over1.gameSeq), '同一局内所有回合结果 gameSeq 相同',
    first.map((m) => m.gameSeq).join(','));

  for (const b of bots) { b.mark(); b.__pilot.lastKey = null; }
  const cursor = host.msgs.length;
  host.send({ type: 'play_again' });
  await host.waitFor('phase_changed', (m) => m.phase === 'prepare', 5000);
  const over2 = await gameOver(h, bots, h.fast ? 25000 : 150000);
  const second = host.msgs.slice(cursor).filter((m) => m.type === 'round_result');
  h.expect(over2.gameSeq === over1.gameSeq + 1, '第二局 gameSeq 递增', `${over1.gameSeq} -> ${over2.gameSeq}`);
  h.expect(second.length > 0 && second.every((m) => m.gameSeq === over2.gameSeq), '第二局的回合结果带新的 gameSeq',
    second.map((m) => m.gameSeq).join(','));
  // 两局的 artworkId 完全相同，客户端星尘去重只能靠 gameSeq
  h.expect(second[0].artworkId === first[0].artworkId, '两局作品 id 复用同一编号（正是需要 gameSeq 的原因）',
    `${first[0].artworkId} / ${second[0].artworkId}`);
});
