(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ---------- 全局状态 ----------
  const state = {
    ws: null,
    roomCode: null,
    playerId: null,
    token: null,
    nickname: '',
    shareUrl: '',
    room: null,
    you: null,
    players: [],
    phase: 'waiting',
    drawerId: null,
    deadline: null,
    paused: false,
    pauseDeadline: null,
    wordMasked: '',
    wordDescription: '',
    category: '',
    privateWord: '',
    guessed: false,
    connected: false,
    intentionalClose: false,
    reconnectDelay: 1000,
    reconnectTimer: null,
    currentTab: 'chat',
    gotFirstState: false,
    serverOffset: null,
    choosing: false,
    wordOptions: [],
    hintText: '',
    bulletsOn: localStorage.getItem('dg_bullets') !== '0',
    pendingJoinCode: null,
    currentArtwork: null,
    resultEndsAt: null,
    skipVotes: 0,
    skipRequired: 0,
    skipVoted: false,
    replayToken: 0,
    replayStrokes: [],
    relayTask: null,
    relayRevealBooks: null,
    relayDidDraw: false,
    relayBookIndex: null,
    musicQueue: [],
    musicRoomCurrent: null,
    musicCurrent: null,
    biliResolved: null,
    musicSource: 'gd',
    gdResults: [],
    musicLyric: '',
    lyricLines: [],
    lyricsFloatOn: localStorage.getItem('dg_float_lyrics') === '1',
    musicPlaybackStatus: 'idle',
    musicPendingSong: null,
    musicAudioUnlocked: false,
    memePacks: [],
    memeAudioUnlocked: false,
  };

  const MEME_PACK_FALLBACK = [
    { id: 'impact-boom-01', name: 'Vine Boom · 震撼一击', category: 'impact', image: 'images/impact-boom-01-real.gif', audio: 'audio/impact-boom-01.mp3', volume: 0.82 },
    { id: 'deadpan-drop-01', name: 'BRUH · 冷静下坠', category: 'reaction', image: 'images/deadpan-drop-01-real.gif', audio: 'audio/deadpan-drop-01.mp3', volume: 0.7 },
    { id: 'party-horn-01', name: 'MLG Air Horn · 派对号角', category: 'celebration', image: 'images/party-horn-01-real.gif', audio: 'audio/party-horn-01.mp3', volume: 0.68 },
    { id: 'fail-buzzer-01', name: 'Sad Song · 失败', category: 'fail', image: 'images/fail-buzzer-01-real.gif', audio: 'audio/fail-buzzer-01.mp3', volume: 0.62 },
    { id: 'surprise-rise-01', name: 'What the Hell Boy · 等等什么', category: 'surprise', image: 'images/surprise-rise-01-real.gif', audio: 'audio/surprise-rise-01.mp3', volume: 0.65 },
    { id: 'victory-fanfare-01', name: 'DaBaby Let’s Go · 这波赢麻了', category: 'victory', image: 'images/victory-fanfare-01-real.gif', audio: 'audio/victory-fanfare-01.mp3', volume: 0.72 },
    { id: 'emotional-damage-02', name: 'Emotional Damage · 破防暴击', category: 'reaction', image: 'images/emotional-damage-02-real.gif', audio: 'audio/emotional-damage-02.mp3', volume: 0.72 },
    { id: 'bonk-doge-02', name: 'BONK · 狗头制裁', category: 'impact', image: 'images/bonk-doge-02-real.gif', audio: 'audio/bonk-doge-02.mp3', volume: 0.78 },
    { id: 'coffin-dance-02', name: 'Coffin Dance · 棺材舞送走', category: 'fail', image: 'images/coffin-dance-02-real.gif', audio: 'audio/coffin-dance-02.mp3', volume: 0.58 },
    { id: 'gta-wasted-02', name: 'GTA Wasted · 当场寄', category: 'fail', image: 'images/gta-wasted-02-real.gif', audio: 'audio/gta-wasted-02.mp3', volume: 0.65 },
    { id: 'fbi-open-up-02', name: 'FBI Open Up · 破门突袭', category: 'surprise', image: 'images/fbi-open-up-02-real.gif', audio: 'audio/fbi-open-up-02.mp3', volume: 0.72 },
    { id: 'sad-violin-02', name: 'Sad Violin · 悲情拉满', category: 'reaction', image: 'images/sad-violin-02-real.gif', audio: 'audio/sad-violin-02.mp3', volume: 0.6 },
    { id: 'among-us-emergency-03', name: 'Among Us Emergency · 紧急会议', category: 'surprise', image: 'images/among-us-emergency-03-real.gif', audio: 'audio/among-us-emergency-03.mp3', volume: 0.72 },
    { id: 'why-running-03', name: 'Why Are You Running · 为什么要跑', category: 'reaction', image: 'images/why-running-03-real.gif', audio: 'audio/why-running-03.mp3', volume: 0.75 },
    { id: 'cut-g-03', name: 'I Like Your Cut G · 这发型可以', category: 'impact', image: 'images/cut-g-03-real.gif', audio: 'audio/cut-g-03.mp3', volume: 0.68 },
    { id: 'trololo-03', name: 'Trololo · 魔性洗脑', category: 'reaction', image: 'images/trololo-03-real.gif', audio: 'audio/trololo-03.mp3', volume: 0.55 },
    { id: 'its-corn-03', name: 'It’s Corn · 玉米之歌', category: 'celebration', image: 'images/its-corn-03-real.gif', audio: 'audio/its-corn-03.mp3', volume: 0.58 },
    { id: 'happy-happy-03', name: 'Happy Happy Happy · 开心连击', category: 'celebration', image: 'images/happy-happy-03-real.gif', audio: 'audio/happy-happy-03.mp3', volume: 0.55 },
    { id: 'few-moments-later-04', name: 'A Few Moments Later · 过了一会儿', category: 'transition', image: 'images/few-moments-later-04-real.gif', audio: 'audio/few-moments-later-04.mp3', volume: 0.65 },
    { id: 'hello-there-04', name: 'Hello There · 老朋友登场', category: 'reaction', image: 'images/hello-there-04-real.gif', audio: 'audio/hello-there-04.mp3', volume: 0.68 },
    { id: 'john-cena-04', name: 'John Cena Intro · 隐形登场', category: 'celebration', image: 'images/john-cena-04-real.gif', audio: 'audio/john-cena-04.mp3', volume: 0.62 },
    { id: 'mario-falling-04', name: 'Mario Oof · 坠落失误', category: 'fail', image: 'images/mario-falling-04-real.gif', audio: 'audio/mario-falling-04.mp3', volume: 0.72 },
    { id: 'just-kidding-04', name: 'Sike · 逗你玩的', category: 'reaction', image: 'images/just-kidding-04-real.gif', audio: 'audio/sike-04.wav', volume: 0.72 },
    { id: 'turtles-04', name: 'I Like Turtles · 我喜欢海龟', category: 'reaction', image: 'images/turtles-04-real.gif', audio: 'audio/turtles-04.mp3', volume: 0.62 },
    { id: 'crab-rave-05', name: 'Crab Rave · 螃蟹开趴', category: 'celebration', image: 'images/crab-rave-05-real.gif', audio: 'audio/crab-rave-05.mp3', volume: 0.55 },
    { id: 'crazy-frog-05', name: 'Crazy Frog · 蛙式乱入', category: 'celebration', image: 'images/crazy-frog-05-real.gif', audio: 'audio/crazy-frog-05.mp3', volume: 0.58 },
    { id: 'badum-tss-05', name: 'Ba Dum Tss · 笑点收尾', category: 'impact', image: 'images/badum-tss-05-real.gif', audio: 'audio/badum-tss-05.mp3', volume: 0.65 },
    { id: 'hog-rider-05', name: 'Hog Rider · 野猪冲锋', category: 'impact', image: 'images/hog-rider-05-real.gif', audio: 'audio/hog-rider-05.mp3', volume: 0.68 },
    { id: 'goofy-yell-05', name: 'Goofy Yell · 高飞怪叫', category: 'reaction', image: 'images/goofy-yell-05-real.gif', audio: 'audio/goofy-yell-05.mp3', volume: 0.62 },
    { id: 'kirby-falls-05', name: 'Kirby Falls · 卡比坠落', category: 'fail', image: 'images/kirby-falls-05-real.gif', audio: 'audio/kirby-falls-05-bili.mp3', volume: 0.58 },
  ];
  const memePackById = new Map();

  function memePackAsset(pathname) {
    const value = String(pathname || '').replace(/^\/+/, '');
    return `/assets/meme-packs/${value}`;
  }

  function renderMemePackMenu() {
    const menu = $('#memePackMenu');
    if (!menu) return;
    menu.innerHTML = '';
    for (const pack of state.memePacks) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'meme-pack-option';
      button.dataset.packId = pack.id;
      button.setAttribute('role', 'menuitem');
      const image = document.createElement('img');
      image.src = memePackAsset(pack.image);
      image.alt = `${pack.name} 表情包`;
      image.loading = 'lazy';
      const name = document.createElement('span');
      name.className = 'meme-pack-option-name';
      name.textContent = pack.name;
      const meta = document.createElement('span');
      meta.className = 'meme-pack-option-meta';
      meta.textContent = 'GIF + 原版梗音 · ≤5 秒';
      button.append(image, name, meta);
      button.addEventListener('click', () => {
        send({ type: 'meme_pack', packId: pack.id });
        menu.classList.add('hidden');
        const toggle = $('#memePackToggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(button);
    }
  }

  async function loadMemePacks() {
    // 先同步放入内置清单，避免网络请求尚未完成时按钮没有内容。
    state.memePacks = MEME_PACK_FALLBACK;
    memePackById.clear();
    state.memePacks.forEach((pack) => {
      memePackById.set(pack.id, {
        ...pack,
        imageUrl: memePackAsset(pack.image),
        audioUrl: memePackAsset(pack.audio),
      });
    });
    renderMemePackMenu();

    let packs = MEME_PACK_FALLBACK;
    try {
      const response = await fetch('/assets/meme-packs/manifest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.packs) && data.packs.length) packs = data.packs;
    } catch {
      // 离线或旧服务端时仍显示内置的首批六个包。
    }
    state.memePacks = packs.filter((pack) => pack && pack.id && pack.image && pack.audio);
    memePackById.clear();
    state.memePacks.forEach((pack) => {
      memePackById.set(pack.id, {
        ...pack,
        imageUrl: memePackAsset(pack.image),
        audioUrl: memePackAsset(pack.audio),
      });
    });
    renderMemePackMenu();
  }

  function showMemePack(msg) {
    const pack = memePackById.get(String(msg.packId || ''));
    const layer = $('#memePackLayer');
    if (!pack || !layer) return;
    while (layer.children.length >= 12) layer.firstElementChild.remove();

    const item = document.createElement('div');
    item.className = 'meme-pack-barrage';
    item.style.top = `${10 + Math.random() * 72}%`;
    const displayDurationMs = Math.min(5000, Math.max(2800, Number(pack.durationMs) || 5000));
    item.style.setProperty('--meme-duration', `${(displayDurationMs / 1000).toFixed(2)}s`);
    const image = document.createElement('img');
    image.src = pack.imageUrl;
    image.alt = `${pack.name} GIF`;
    const copy = document.createElement('div');
    copy.className = 'meme-pack-barrage-copy';
    const name = document.createElement('div');
    name.className = 'meme-pack-barrage-name';
    name.textContent = pack.name;
    const who = document.createElement('div');
    who.className = 'meme-pack-barrage-who';
    who.textContent = `${msg.nickname || '玩家'} 发出`;
    copy.append(name, who);
    item.append(image, copy);
    item.addEventListener('animationend', () => item.remove(), { once: true });
    layer.appendChild(item);

    const audio = new Audio(pack.audioUrl);
    audio.preload = 'auto';
    audio.volume = Math.min(1, Math.max(0, Number(pack.volume) || 0.72));
    state.memeAudioUnlocked = true;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    const stopTimer = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, Math.min(5000, Math.max(0, Number(pack.durationMs) || 5000)));
    audio.addEventListener('ended', () => window.clearTimeout(stopTimer), { once: true });
    addChat({ system: true, text: `${msg.nickname || '玩家'} 发出了 ${pack.name} 🎞` });
  }

  // ---------- 笔皮肤 / 免费抽卡 ----------
  // 收藏与抽卡数据留在本机；当前装备的皮肤 ID 会同步给房间，用于显示画手笔尖。
  const PEN_STORAGE_KEY = 'dg_pen_collection_v1';
  const PEN_DRAW_COST = 1;
  // 项目目前没有登录账号体系，因此把无限抽卡限定在本机 localhost 测试端。
  // 远程玩家通过局域网或公网访问时不会进入该模式，也不会将权限发给房间内其他人。
  const PEN_LOCAL_TEST_MODE = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const PEN_SKINS = [
    {
      id: 'classic-pencil',
      name: '经典铅笔',
      rarity: 'free',
      rarityLabel: '免费',
      asset: 'classic-pencil.webp',
      description: '永久免费领取的第一支笔。',
    },
    {
      id: 'crayon-pop',
      name: '蜡笔泡泡',
      rarity: 'common',
      rarityLabel: '普通',
      asset: 'crayon-pop.webp',
      description: '像盒彩笔一样元气的红橙蜡笔。',
    },
    {
      id: 'rainbow-marker',
      name: '彩虹马克笔',
      rarity: 'rare',
      rarityLabel: '稀有',
      asset: 'rainbow-marker.webp',
      description: '把彩虹藏进笔杆的小小马克笔。',
    },
    {
      id: 'pixel-arcade',
      name: '像素街机',
      rarity: 'rare',
      rarityLabel: '稀有',
      asset: 'pixel-arcade.webp',
      description: '复古街机风格的像素画笔。',
    },
    {
      id: 'ink-brush',
      name: '一笔水墨',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'ink-brush.webp',
      description: '安静、利落的东方水墨笔。',
    },
    {
      id: 'starry-doodle',
      name: '星光涂鸦笔',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'starry-doodle.webp',
      description: '把小星星画在笔杆上的涂鸦笔。',
    },
    {
      id: 'crystal-turret',
      name: '水晶防御塔',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'crystal-turret.webp',
      description: '把深蓝石甲、蓝色水晶和红色能量核心缩成一支战斗画笔。',
    },
    {
      id: 'windblade',
      name: '疾风剑意',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'windblade.webp',
      description: '将蓝色风纹、银色护手与剑意收进一支疾风画笔。',
    },
    {
      id: 'mushroom-scout',
      name: '蘑菇侦察员',
      rarity: 'rare',
      rarityLabel: '稀有',
      asset: 'mushroom-scout.webp',
      description: '橄榄绿侦察笔，带着一顶醒目的红色蘑菇帽。',
    },
    {
      id: 'coke-refresh',
      name: '畅爽红·可口可乐',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'coke-refresh.webp',
      description: '红白飘带、气泡与瓶盖，把清爽装进每一笔。',
    },
    {
      id: 'paimon-starlight',
      name: '星海领航·派蒙',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'paimon-legend.webp',
      effectId: 'paimon-stardust',
      description: '派蒙陪你把星光写进每一笔。',
    },
    {
      id: 'pikachu-thunderbolt',
      name: '皮卡丘·电光奇缘',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'pikachu-thunderbolt.webp',
      effectId: 'pikachu-voltage',
      description: '黄色电气伙伴、闪电纹路与红色能量宝石组成的传说画笔。',
    },
    {
      id: 'miku-future-echo',
      name: '初音·未来回响',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'miku-future-echo.webp',
      effectId: 'miku-chorus',
      description: '青绿色双马尾歌姬、音符波形与青粉舞台灯光组成的传说画笔。',
    },
    {
      id: 'teto-crimson-chorus',
      name: '重音Teto·绯红节拍',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'teto-crimson-chorus.webp',
      effectId: 'teto-rhythm',
      description: '绯红双钻头歌姬、心跳波形与音符棱光组成的传说画笔。',
    },
    {
      id: 'persona3-blue-hour',
      name: 'Persona 3·深蓝月蚀',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'persona3-blue-hour-v2.webp',
      effectId: 'persona3-arcana',
      description: '深蓝时刻、月相时钟与塔罗召唤意象组成的 Persona 3 主题传说画笔。',
    },
    {
      id: 'voxel-overworld',
      name: '方块秘境·钻石笔',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'voxel-overworld.webp',
      effectId: 'voxel-trail',
      description: '草方块、矿石与钻石水晶组成的方块沙盒传说笔。',
    },
    {
      id: 'burger-buddy',
      name: '芝士汉堡·畅画笔',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'burger-buddy.webp',
      description: '芝麻面包、生菜、芝士、番茄与烤肉排叠成的元气汉堡画笔。',
    },
    {
      id: 'dragon-ink',
      name: '龙焰秘典·龙笔',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'dragon-ink.webp',
      effectId: 'dragon-flame',
      description: '金色古典龙纹缠绕黑铁笔杆，赤鳞与琥珀宝石守住每一笔。',
    },
    {
      id: 'infinity-edge',
      name: '无尽之刃·暴击锋芒',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'infinity-edge.webp',
      effectId: 'infinity-edge-crit',
      description: '银钢双刃、深色剑脊、金色符文与红色宝石护手组成的原创无尽之刃主题画笔。',
    },
    {
      id: 'fire-kylin',
      name: 'AK47·火麒麟',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'fire-kylin-v4.webp',
      effectId: 'fire-kylin-flame',
      description: '黑红 AK 轮廓、金色龙纹、木质枪托与发光麒麟兽首组成的传说画笔。',
    },
    {
      id: 'milk-tea',
      name: '珍珠奶茶·甜甜笔',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'milk-tea.webp',
      description: '茶色渐变、奶盖、珍珠和吸管组成的奶茶主题画笔。',
    },
    {
      id: 'bocchi-lonely-rock',
      name: '波奇·孤独摇弦',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'bocchi-lonely-rock.webp',
      effectId: 'bocchi-stage',
      description: '粉蓝电吉他、六弦拾音器、蓝黄几何挂件与社恐音浪组成的原创摇滚传说笔。',
    },
    {
      id: 'kuuga-mighty-legacy',
      name: '空我·赤色灵石',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'kuuga-mighty-legacy.webp',
      effectId: 'kuuga-seal',
      description: '赤色装甲、黑金古代纹路、红色灵石核心与双角护冠组成的原创骑士传说笔。',
    },
    {
      id: 'whale-maid-tide',
      name: '鲸蓝女仆·潮汐礼赞',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'whale-maid-tide.webp',
      effectId: 'whale-tide',
      description: '鲸尾、白色褶边、蓝色蝴蝶结与海潮宝石组成的原创鲸蓝女仆传说笔。',
    },
    {
      id: 'luo-tianyi-resonance',
      name: '洛天依·共鸣天籁',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'luo-tianyi-resonance.webp',
      effectId: 'luo-tianyi-resonance',
      description: '天依蓝、银白飘带、麦克风声波与共鸣晶体组成的原创电子歌姬传说笔。',
    },
    {
      id: 'snowking-frost',
      name: '冰爽雪王·蜜雪主题',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'snowking-frost.webp',
      effectId: 'snowking-frost',
      description: '红白冰饮、柠檬雪花、冰晶与原创雪人挂件组成的清凉主题画笔。',
    },
    {
      id: 'eva-unit01',
      name: '初号机·暴走画笔',
      rarity: 'legendary',
      rarityLabel: '传说',
      asset: 'eva-unit01.webp',
      effectId: 'eva-awakening',
      description: '紫色装甲、荧光绿结构和橙色核心组成的觉醒系机械画笔。',
    },
    {
      id: 'wuju-master',
      name: '无极剑意·剑圣笔',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'wuju-master.webp',
      description: '七枚洞察镜片、白色发束与翠金 Wuju 护具组成的剑圣主题画笔。',
    },
    {
      id: 'dongqin-sea-breeze',
      name: '东秦·知行海风',
      rarity: 'epic',
      rarityLabel: '史诗',
      asset: 'dongqin-sea-breeze.webp',
      description: '白山黑水与长城校徽意象、海浪、指南针和工科电路组成的校园主题画笔。',
    },
  ];
  const PEN_SKIN_BY_ID = new Map(PEN_SKINS.map((skin) => [skin.id, skin]));
  // 持续尾迹使用“形状 + 色彩 + 运动方式”的配方，避免所有笔皮肤都落回同一个光环爆点。
  const PEN_TRAIL_PROFILES = Object.freeze({
    'classic-pencil': { kind: 'graphite', color: '#475569', accent: '#cbd5e1', size: 4, distance: 7, interval: 78 },
    'crayon-pop': { kind: 'crayon', color: '#f43f5e', accent: '#facc15', size: 7, distance: 6, interval: 68 },
    'rainbow-marker': { kind: 'ribbon', color: '#38bdf8', accent: '#f472b6', size: 6, distance: 7, interval: 64 },
    'pixel-arcade': { kind: 'pixel', color: '#22d3ee', accent: '#a3e635', size: 6, distance: 5, interval: 72 },
    'ink-brush': { kind: 'ink', color: '#0f172a', accent: '#64748b', size: 8, distance: 8, interval: 86 },
    'starry-doodle': { kind: 'star', glyph: '✦', color: '#fbbf24', accent: '#60a5fa', size: 16, distance: 8, interval: 92 },
    'crystal-turret': { kind: 'crystal', color: '#60a5fa', accent: '#c4b5fd', size: 8, distance: 8, interval: 74 },
    windblade: { kind: 'wind', color: '#bae6fd', accent: '#60a5fa', size: 5, distance: 12, interval: 58 },
    'mushroom-scout': { kind: 'mushroom', color: '#ef4444', accent: '#facc15', size: 7, distance: 5, interval: 82 },
    'coke-refresh': { kind: 'bubble', color: '#f87171', accent: '#f8fafc', size: 8, distance: 9, interval: 88 },
    'paimon-starlight': { kind: 'star', glyph: '✧', color: '#60a5fa', accent: '#fbbf24', size: 17, distance: 10, interval: 76 },
    'pikachu-thunderbolt': { kind: 'zigzag', color: '#fde047', accent: '#38bdf8', size: 10, distance: 12, interval: 56 },
    'miku-future-echo': { kind: 'wave', color: '#22d3ee', accent: '#f472b6', size: 11, distance: 10, interval: 66 },
    'teto-crimson-chorus': { kind: 'note', glyph: '♪', color: '#fb7185', accent: '#fda4af', size: 16, distance: 10, interval: 74 },
    'persona3-blue-hour': { kind: 'card', color: '#38bdf8', accent: '#c4b5fd', size: 10, distance: 12, interval: 78 },
    'voxel-overworld': { kind: 'pixel', color: '#22d3ee', accent: '#a3e635', size: 7, distance: 5, interval: 55 },
    'burger-buddy': { kind: 'crumb', color: '#f59e0b', accent: '#fde68a', size: 7, distance: 5, interval: 88 },
    'dragon-ink': { kind: 'ember', color: '#f97316', accent: '#fbbf24', size: 8, distance: 11, interval: 64 },
    'infinity-edge': { kind: 'slash', color: '#fbbf24', accent: '#ef4444', size: 6, distance: 14, interval: 52 },
    'fire-kylin': { kind: 'flame', color: '#f97316', accent: '#facc15', size: 10, distance: 13, interval: 54 },
    'bocchi-lonely-rock': { kind: 'bocchi-wave', color: '#f472b6', accent: '#38bdf8', size: 10, distance: 10, interval: 58 },
    'kuuga-mighty-legacy': { kind: 'kuuga-seal', glyph: '◇', color: '#ef4444', accent: '#facc15', size: 13, distance: 12, interval: 56 },
    'whale-maid-tide': { kind: 'whale-tide', glyph: '◌', color: '#60a5fa', accent: '#e0f2fe', size: 12, distance: 11, interval: 60 },
    'luo-tianyi-resonance': { kind: 'luo-resonance', glyph: '♪', color: '#22d3ee', accent: '#c4b5fd', size: 13, distance: 12, interval: 58 },
    'milk-tea': { kind: 'pearl', color: '#f59e0b', accent: '#fef3c7', size: 8, distance: 7, interval: 82 },
    'snowking-frost': { kind: 'snowflake', glyph: '✳', color: '#bae6fd', accent: '#fef08a', size: 14, distance: 10, interval: 70 },
    'eva-unit01': { kind: 'shard', color: '#a855f7', accent: '#a3e635', size: 9, distance: 13, interval: 56 },
    'wuju-master': { kind: 'rune', glyph: '◇', color: '#34d399', accent: '#facc15', size: 16, distance: 11, interval: 78 },
    'dongqin-sea-breeze': { kind: 'wave', color: '#38bdf8', accent: '#f8fafc', size: 10, distance: 9, interval: 74 },
  });
  // 锚点是相对于 64px 光标盒的归一化坐标，不是素材原图坐标。
  // 这样可以同时处理正方形素材和 object-fit: contain 产生留白的竖版素材。
  const PEN_CURSOR_ANCHOR_DEFAULT = Object.freeze([0.078, 0.922]);
  const PEN_CURSOR_ANCHORS = Object.freeze({
    'classic-pencil': [0.075, 0.952],
    'crayon-pop': [0.165, 0.93],
    'rainbow-marker': [0.11, 0.91],
    'pixel-arcade': [0.06, 0.95],
    'ink-brush': [0.075, 0.953],
    'starry-doodle': [0.052, 0.963],
    'crystal-turret': [0.115, 0.963],
    'windblade': [0.052, 0.85],
    'mushroom-scout': [0.052, 0.84],
    'coke-refresh': [0.05, 0.97],
    'paimon-starlight': [0.052, 0.9],
    'pikachu-thunderbolt': [0.075, 0.98],
    'miku-future-echo': [0.038, 0.964],
    'teto-crimson-chorus': [0.039, 0.964],
    'persona3-blue-hour': [0.035, 0.985],
    'voxel-overworld': [0.388, 0.95],
    'burger-buddy': [0.405, 0.95],
    'dragon-ink': [0.414, 0.99],
    'infinity-edge': [0.049, 0.850],
    'fire-kylin': [0.977, 0.199],
    'bocchi-lonely-rock': [0.061, 0.972],
    'kuuga-mighty-legacy': [0.039, 0.922],
    'whale-maid-tide': [0.04, 0.92],
    'luo-tianyi-resonance': [0.06, 0.968],
    'milk-tea': [0.346, 0.995],
    'snowking-frost': [0.13, 0.81],
    'eva-unit01': [0.381, 0.98],
    'wuju-master': [0.63, 0.99],
    'dongqin-sea-breeze': [0.052, 0.98],
  });
  const PEN_RARITY_META = {
    free: { label: '免费', className: 'free', fragments: 0 },
    common: { label: '普通', className: 'common', fragments: 8 },
    rare: { label: '稀有', className: 'rare', fragments: 20 },
    epic: { label: '史诗', className: 'epic', fragments: 50 },
    legendary: { label: '传说', className: 'legendary', fragments: 120 },
  };

  function defaultPenCollection() {
    return {
      version: 1,
      selected: 'classic-pencil',
      owned: ['classic-pencil'],
      stardust: 3,
      fragments: 0,
      bonusDraws: 0,
      totalDraws: 0,
      pityRare: 0,
      pityEpic: 0,
      pityLegendary: 0,
      rewardKeys: [],
    };
  }

  function clampInteger(value, min, max) {
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, number));
  }

  function savePenCollection() {
    try {
      localStorage.setItem(PEN_STORAGE_KEY, JSON.stringify(penCollection));
    } catch {
      // 隐私模式或存储空间不足时，仍保留本次页面内的装饰状态。
    }
  }

  function loadPenCollection() {
    const fallback = defaultPenCollection();
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(PEN_STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved || typeof saved !== 'object') {
      try {
        localStorage.setItem(PEN_STORAGE_KEY, JSON.stringify(fallback));
      } catch {
        // 存储不可用时仍返回这次会话的免费初始资源。
      }
      return fallback;
    }
    const owned = Array.isArray(saved.owned)
      ? saved.owned.filter((id) => PEN_SKIN_BY_ID.has(id))
      : [];
    if (!owned.includes('classic-pencil')) owned.unshift('classic-pencil');
    return {
      version: 1,
      selected: owned.includes(saved.selected) ? saved.selected : 'classic-pencil',
      owned: [...new Set(owned)],
      stardust: clampInteger(saved.stardust, 0, 99999),
      fragments: clampInteger(saved.fragments, 0, 999999),
      bonusDraws: clampInteger(saved.bonusDraws, 0, 9999),
      totalDraws: clampInteger(saved.totalDraws, 0, 999999),
      pityRare: clampInteger(saved.pityRare, 0, 9),
      pityEpic: clampInteger(saved.pityEpic, 0, 29),
      pityLegendary: clampInteger(saved.pityLegendary, 0, 59),
      rewardKeys: Array.isArray(saved.rewardKeys)
        ? saved.rewardKeys.filter((key) => typeof key === 'string').slice(-80)
        : [],
    };
  }

  let penCollection = loadPenCollection();

  const COLORS = [
    '#111827', '#6b7280', '#f8fafc', '#dc2626', '#f97316', '#f59e0b', '#eab308', '#16a34a',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#2563eb', '#4f46e5', '#7c3aed', '#a855f7',
    '#d946ef', '#db2777', '#92400e', '#78350f', '#fca5a5', '#fdba74', '#fde68a', '#bbf7d0',
  ];
  const QUICK_COLORS = COLORS.slice(0, 8);
  const SIZES = [0.0035, 0.0065, 0.011];
  const brush = { color: COLORS[0], size: SIZES[1], tool: 'pen', skin: penCollection.selected };
  const penCursor = {
    element: $('#penCursor'),
    image: $('#penCursorImage'),
  };
  const remotePenCursor = {
    element: $('#remotePenCursor'),
    image: $('#remotePenCursorImage'),
    playerId: null,
  };
  const musicAudio = new Audio();
  let musicPlayingKey = null;

  // 猜中提示音：使用 Web Audio 合成短促的上行双音，不依赖外部人声素材。
  let lastCorrectGuessSfxAt = 0;

  function playCorrectGuessTone() {
    const now = performance.now();
    if (now - lastCorrectGuessSfxAt < 420) return;
    lastCorrectGuessSfxAt = now;
    const context = ensureGachaAudioContext();
    if (!context) return;
    const start = context.currentTime;
    const notes = [
      { frequency: 660, offset: 0, duration: 0.09 },
      { frequency: 880, offset: 0.095, duration: 0.13 },
    ];
    notes.forEach(({ frequency, offset, duration }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + offset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration + 0.01);
    });
  }

  // ---------- 抽卡音效（仅本地开发占位） ----------
  // 这里保留 CSGO 原声文件名作为可替换槽位。项目正式分发前请替换成自制或已获授权的音效。
  const PEN_GACHA_SFX = Object.freeze({
    unlock: '/assets/audio/gacha-dev/case_unlock_01.wav',
    scroll: '/assets/audio/gacha-dev/csgo_ui_crate_item_scroll.wav',
    open: '/assets/audio/gacha-dev/csgo_ui_crate_open.wav',
    common: '/assets/audio/gacha-dev/case_awarded_0_common_01.wav',
    rare: '/assets/audio/gacha-dev/case_reveal_rare_01.wav',
    epic: '/assets/audio/gacha-dev/case_reveal_mythical_01.wav',
    legendary: '/assets/audio/gacha-dev/case_reveal_legendary_01.wav',
  });
  const gachaAudio = {
    context: null,
    lastScrollAt: 0,
  };
  let penGachaOpening = false;
  const legendaryAnnouncementState = {
    queue: [],
    timer: null,
    active: false,
    seen: new Set(),
  };
  const gachaGrantAnnouncementState = {
    queue: [],
    timer: null,
    active: false,
  };

  function ensureGachaAudioContext() {
    if (gachaAudio.context) {
      if (gachaAudio.context.state === 'suspended') gachaAudio.context.resume().catch(() => {});
      return gachaAudio.context;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      gachaAudio.context = new AudioContextCtor();
      if (gachaAudio.context.state === 'suspended') gachaAudio.context.resume().catch(() => {});
    } catch {
      gachaAudio.context = null;
    }
    return gachaAudio.context;
  }

  function playGachaFallback(key, rarity = 'common') {
    const context = ensureGachaAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const isScroll = key === 'scroll';
    const frequency = isScroll
      ? 460 + Math.round(randomFloat() * 80)
      : (rarity === 'legendary' ? 880 : (rarity === 'epic' ? 620 : 360));
    const duration = isScroll ? 0.045 : (key === 'open' ? 0.18 : 0.12);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = rarity === 'legendary' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (key === 'open') oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.8, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isScroll ? 0.025 : 0.055, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  function playGachaSfx(key, { rarity = 'common', volume = 0.42 } = {}) {
    if (key === 'scroll' && performance.now() - gachaAudio.lastScrollAt < 65) return;
    if (key === 'scroll') gachaAudio.lastScrollAt = performance.now();
    ensureGachaAudioContext();
    const source = PEN_GACHA_SFX[key];
    if (!source) {
      playGachaFallback(key, rarity);
      return;
    }
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = key === 'scroll' ? 0.98 + randomFloat() * 0.05 : 1;
    let fallbackPlayed = false;
    const fallback = () => {
      if (fallbackPlayed) return;
      fallbackPlayed = true;
      playGachaFallback(key, rarity);
    };
    audio.addEventListener('error', fallback, { once: true });
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') promise.catch(fallback);
  }

  function hexToRgb(hex) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return [17, 24, 39];
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  }

  const SHAPE_TOOLS = new Set(['rect', 'circle', 'triangle']);

  function isShapeTool(tool) {
    return SHAPE_TOOLS.has(tool);
  }

  function drawShapeOutline(ctx, tool, start, end, width, height) {
    const [x0, y0] = [start[0] * width, start[1] * height];
    const [x1, y1] = [end[0] * width, end[1] * height];
    const minX = Math.min(x0, x1);
    const minY = Math.min(y0, y1);
    const shapeWidth = Math.abs(x1 - x0);
    const shapeHeight = Math.abs(y1 - y0);
    ctx.beginPath();
    if (tool === 'circle') {
      const radius = Math.max(Math.min(shapeWidth, shapeHeight) / 2, ctx.lineWidth / 2);
      ctx.ellipse(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        radius,
        radius,
        0,
        0,
        Math.PI * 2,
      );
    } else if (tool === 'triangle') {
      ctx.moveTo(minX + shapeWidth / 2, minY);
      ctx.lineTo(minX + shapeWidth, minY + shapeHeight);
      ctx.lineTo(minX, minY + shapeHeight);
      ctx.closePath();
    } else {
      ctx.rect(minX, minY, shapeWidth, shapeHeight);
    }
    ctx.stroke();
  }

  // 在当前画布像素上做容差填充，避免抗锯齿线条导致油漆桶漏色。
  function floodFillCanvas(ctx, xNorm, yNorm, color, tolerance = 26) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    if (!width || !height) return false;
    const startX = Math.min(width - 1, Math.max(0, Math.floor(Number(xNorm) * width)));
    const startY = Math.min(height - 1, Math.max(0, Math.floor(Number(yNorm) * height)));
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const startIndex = (startY * width + startX) * 4;
    const target = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];
    const fill = [...hexToRgb(color), 255];
    const closeEnough = (index) => (
      Math.abs(data[index] - target[0]) <= tolerance
      && Math.abs(data[index + 1] - target[1]) <= tolerance
      && Math.abs(data[index + 2] - target[2]) <= tolerance
      && Math.abs(data[index + 3] - target[3]) <= tolerance
    );
    if (Math.abs(target[0] - fill[0]) <= 2
      && Math.abs(target[1] - fill[1]) <= 2
      && Math.abs(target[2] - fill[2]) <= 2
      && target[3] === 255) return false;

    const total = width * height;
    const queue = new Int32Array(total);
    const visited = new Uint8Array(total);
    let head = 0;
    let tail = 0;
    const enqueue = (pixel) => {
      if (pixel < 0 || pixel >= total || visited[pixel]) return;
      visited[pixel] = 1;
      queue[tail] = pixel;
      tail += 1;
    };
    enqueue(startY * width + startX);
    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      const index = pixel * 4;
      if (!closeEnough(index)) continue;
      data[index] = fill[0];
      data[index + 1] = fill[1];
      data[index + 2] = fill[2];
      data[index + 3] = fill[3];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      if (x > 0) enqueue(pixel - 1);
      if (x + 1 < width) enqueue(pixel + 1);
      if (y > 0) enqueue(pixel - width);
      if (y + 1 < height) enqueue(pixel + width);
    }
    ctx.putImageData(image, 0, 0);
    return true;
  }

  // ---------- 画板引擎 ----------
  class Board {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.strokes = [];
      this.byId = new Map();
      this.active = null;
      this.lastPoint = null;
      this.activePointerId = null;
      this.pending = [];
      this.lastSend = 0;
      this.replaying = false;
      this.selectionIds = new Set();
      this.selectionDrag = null;
      this.cssWidth = canvas.clientWidth || 600;
      this.cssHeight = canvas.clientHeight || 600;
      this.bindPointer();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.cssWidth = Math.max(10, rect.width);
      this.cssHeight = Math.max(10, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(this.cssWidth * dpr);
      const h = Math.round(this.cssHeight * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.renderAll();
      }
    }

    reset() {
      this.strokes = [];
      this.byId.clear();
      this.active = null;
      this.lastPoint = null;
      this.activePointerId = null;
      this.pending = [];
      this.selectionIds.clear();
      this.selectionDrag = null;
      this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
      hidePenCursor();
      hideRemotePenCursor();
      clearPenEffects();
    }

    renderAll() {
      this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
      for (const stroke of this.strokes) {
        if (stroke.kind === 'fill') {
          floodFillCanvas(this.ctx, stroke.x, stroke.y, stroke.color);
          continue;
        }
        if (stroke.kind === 'move') continue;
        stroke.rendered = 0;
        this.renderStroke(stroke);
      }
      this.renderSelectionOverlay();
    }

    tracePen(stroke, start, sizePx, alpha = 1, widthScale = 1, offsetX = 0, offsetY = 0) {
      const pts = stroke.points;
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1, sizePx * widthScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.translate(offsetX, offsetY);

      if (start === 0) {
        const [x0, y0] = this.toPx(pts[0]);
        ctx.beginPath();
        ctx.arc(x0, y0, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (pts.length > 1) {
        ctx.beginPath();
        const fromIdx = Math.max(1, start);
        const [sx, sy] = this.toPx(pts[fromIdx - 1]);
        ctx.moveTo(sx, sy);
        for (let i = fromIdx; i < pts.length; i += 1) {
          const [x, y] = this.toPx(pts[i]);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    tracePixel(stroke, start, sizePx) {
      const pts = stroke.points;
      const ctx = this.ctx;
      const cell = Math.max(4, sizePx);
      ctx.save();
      ctx.fillStyle = stroke.color;
      const drawCell = (x, y) => {
        const cx = Math.round(x / cell) * cell;
        const cy = Math.round(y / cell) * cell;
        ctx.fillRect(cx, cy, cell, cell);
      };
      if (start === 0) {
        const [x0, y0] = this.toPx(pts[0]);
        drawCell(x0, y0);
      }
      const fromIdx = Math.max(1, start);
      for (let i = fromIdx; i < pts.length; i += 1) {
        const [x1, y1] = this.toPx(pts[i - 1]);
        const [x2, y2] = this.toPx(pts[i]);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const steps = Math.max(1, Math.ceil(dist / (cell * 0.6)));
        for (let k = 0; k <= steps; k += 1) {
          drawCell(x1 + (dx * k) / steps, y1 + (dy * k) / steps);
        }
      }
      ctx.restore();
    }

    traceCrayon(stroke, start, sizePx) {
      const offsets = [
        [0, 0],
        [sizePx * 0.18, sizePx * 0.12],
        [-sizePx * 0.16, sizePx * 0.18],
      ];
      for (const [ox, oy] of offsets) {
        this.tracePen(stroke, start, sizePx, 0.38, 0.55, ox, oy);
      }
    }

    renderStroke(stroke) {
      const pts = stroke.points;
      if (!pts || pts.length === 0) return;
      const start = Math.max(0, stroke.rendered || 0);
      const sizePx = Math.max(1, stroke.size * this.cssWidth);

      if (isShapeTool(stroke.tool)) {
        const end = pts[pts.length - 1] || pts[0];
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.globalAlpha = 1;
        ctx.lineWidth = sizePx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawShapeOutline(ctx, stroke.tool, pts[0], end, this.cssWidth, this.cssHeight);
        ctx.restore();
        stroke.rendered = pts.length;
        return;
      }

      if (stroke.tool === 'crayon') {
        this.traceCrayon(stroke, start, sizePx);
      } else if (stroke.tool === 'pixel') {
        this.tracePixel(stroke, start, sizePx);
      } else if (stroke.tool === 'highlighter') {
        this.tracePen(stroke, start, sizePx, 0.35, 2.6);
      } else {
        this.tracePen(stroke, start, sizePx, 1, 1);
      }
      stroke.rendered = pts.length;
    }

    getSelectionBounds(ids = this.selectionIds) {
      const selected = new Set(ids);
      const bounds = { minX: 1, minY: 1, maxX: 0, maxY: 0, found: false };
      for (const stroke of this.strokes) {
        if (!selected.has(stroke.id) || stroke.kind || !stroke.points?.length) continue;
        for (const [x, y] of stroke.points) {
          bounds.minX = Math.min(bounds.minX, x);
          bounds.minY = Math.min(bounds.minY, y);
          bounds.maxX = Math.max(bounds.maxX, x);
          bounds.maxY = Math.max(bounds.maxY, y);
          bounds.found = true;
        }
      }
      return bounds;
    }

    renderSelectionOverlay() {
      const ctx = this.ctx;
      const bounds = this.getSelectionBounds();
      const rect = this.selectionDrag?.mode === 'marquee'
        ? this.selectionDrag.rect
        : (bounds.found ? bounds : null);
      if (!rect) return;
      const minX = Math.min(rect.minX, rect.maxX) * this.cssWidth;
      const minY = Math.min(rect.minY, rect.maxY) * this.cssHeight;
      const width = Math.abs(rect.maxX - rect.minX) * this.cssWidth;
      const height = Math.abs(rect.maxY - rect.minY) * this.cssHeight;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.selectionDrag?.mode === 'marquee' ? '#2563eb' : '#7c3aed';
      ctx.fillStyle = this.selectionDrag?.mode === 'marquee' ? 'rgba(37,99,235,.08)' : 'rgba(124,58,237,.06)';
      ctx.fillRect(minX, minY, width, height);
      ctx.strokeRect(minX, minY, width, height);
      ctx.restore();
    }

    toPx(p) {
      return [p[0] * this.cssWidth, p[1] * this.cssHeight];
    }

    toNorm(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      return [x, y];
    }

    bindPointer() {
      this.canvas.addEventListener('pointerdown', (e) => {
        if (!canDraw() || (e.isPrimary === false)) return;
        e.preventDefault();
        this.activePointerId = e.pointerId;
        try { this.canvas.setPointerCapture(e.pointerId); } catch { }
        const [x, y] = this.toNorm(e);
        if (brush.tool === 'bucket') {
          this.fillAt(x, y);
          this.releasePointer(e);
          this.activePointerId = null;
          return;
        }
        if (brush.tool === 'select') {
          this.beginSelection(x, y, e.pointerType);
          return;
        }
        updatePenCursor(this.canvas, e);
        this.beginStroke(x, y);
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!canDraw() || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) return;
        e.preventDefault();
        const [x, y] = this.toNorm(e);
        if (this.selectionDrag) {
          this.updateSelection(x, y);
          return;
        }
        if (!this.active) return;
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
        for (const ev of events.length ? events : [e]) {
          updatePenCursor(this.canvas, ev);
          const [x, y] = this.toNorm(ev);
          this.addPoint(x, y);
        }
      });

      const end = (e) => {
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        if (this.selectionDrag) {
          this.finishSelection(e?.type === 'pointercancel');
          this.releasePointer(e);
          this.activePointerId = null;
          return;
        }
        if (!this.active) {
          hidePenCursor();
          this.activePointerId = null;
          return;
        }
        this.releasePointer(e);
        this.endStroke();
        this.activePointerId = null;
      };
      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    releasePointer(e) {
      if (e && this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    }

    beginStroke(x, y) {
      const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const color = brush.tool === 'eraser' ? '#ffffff' : brush.color;
      const size = brush.tool === 'eraser' ? brush.size * 3.2 : brush.size;
      const stroke = { id, color, size, tool: brush.tool, points: [[x, y]], ended: false, rendered: 0 };
      this.strokes.push(stroke);
      this.byId.set(id, stroke);
      this.active = stroke;
      this.lastPoint = [x, y];
      this.pending = [];
      this.lastSend = performance.now();
      this.renderStroke(stroke);
      if (brush.tool !== 'eraser') spawnPenStartEffect(selectedPenSkin(), [x, y]);
      send({ type: 'draw_begin', stroke: { id, color, size, tool: brush.tool, x, y } });
    }

    addPoint(x, y) {
      if (!this.active) return;
      const pt = [x, y];
      const previousPoint = this.lastPoint;
      if (isShapeTool(this.active.tool)) {
        this.active.points = [this.active.points[0], pt];
        this.active.rendered = 0;
        this.renderAll();
        this.lastPoint = pt;
        this.pending = [pt];
        const now = performance.now();
        if (now - this.lastSend >= 33) this.flushPending();
        return;
      }
      this.active.points.push(pt);
      this.renderStroke(this.active);
      if (brush.tool !== 'eraser') {
        spawnPenTrailEffect(selectedPenSkin(), pt, previousPoint);
      }
      this.lastPoint = pt;
      this.pending.push(pt);
      const now = performance.now();
      if (now - this.lastSend >= 33 || this.pending.length >= 80) this.flushPending();
    }

    flushPending() {
      if (!this.active || this.pending.length === 0) return;
      const points = this.pending;
      this.pending = [];
      this.lastSend = performance.now();
      send({ type: 'draw_points', strokeId: this.active.id, points });
    }

    endStroke() {
      if (!this.active) return;
      this.flushPending();
      const stroke = this.active;
      stroke.ended = true;
      this.active = null;
      this.lastPoint = null;
      const endPoint = stroke.points[stroke.points.length - 1];
      if (stroke.tool !== 'eraser') spawnPenEndEffect(selectedPenSkin(), endPoint);
      send({ type: 'draw_end', strokeId: stroke.id });
      hidePenCursor();
    }

    fillAt(x, y) {
      if (this.active || this.selectionDrag) return;
      hidePenCursor();
      const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const fill = { id, kind: 'fill', x, y, color: brush.color, ended: true };
      this.strokes.push(fill);
      this.renderAll();
      send({ type: 'draw_fill', fill: { id, x, y, color: brush.color } });
    }

    hitTestStroke(x, y, pointerType = 'mouse') {
      const px = x * this.cssWidth;
      const py = y * this.cssHeight;
      const touchLike = pointerType === 'touch' || pointerType === 'pen';
      for (let i = this.strokes.length - 1; i >= 0; i -= 1) {
        const stroke = this.strokes[i];
        if (stroke.kind || !stroke.points?.length) continue;
        const threshold = Math.max(touchLike ? 20 : 8, (stroke.size || 0.006) * this.cssWidth * 2.4);
        if (isShapeTool(stroke.tool)) {
          const start = stroke.points[0];
          const end = stroke.points[stroke.points.length - 1] || start;
          const [x0, y0] = this.toPx(start);
          const [x1, y1] = this.toPx(end);
          const segments = [];
          if (stroke.tool === 'circle') {
            const cx = (x0 + x1) / 2;
            const cy = (y0 + y1) / 2;
            const radius = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
            const rx = radius;
            const ry = radius;
            const samples = 32;
            for (let sample = 0; sample < samples; sample += 1) {
              const a = (sample / samples) * Math.PI * 2;
              const b = ((sample + 1) / samples) * Math.PI * 2;
              segments.push([
                [cx + rx * Math.cos(a), cy + ry * Math.sin(a)],
                [cx + rx * Math.cos(b), cy + ry * Math.sin(b)],
              ]);
            }
          } else if (stroke.tool === 'triangle') {
            const minX = Math.min(x0, x1);
            const minY = Math.min(y0, y1);
            const width = Math.abs(x1 - x0);
            const height = Math.abs(y1 - y0);
            const vertices = [
              [minX + width / 2, minY],
              [minX + width, minY + height],
              [minX, minY + height],
            ];
            for (let j = 0; j < vertices.length; j += 1) {
              segments.push([vertices[j], vertices[(j + 1) % vertices.length]]);
            }
          } else {
            const minX = Math.min(x0, x1);
            const minY = Math.min(y0, y1);
            const maxX = Math.max(x0, x1);
            const maxY = Math.max(y0, y1);
            const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
            for (let j = 0; j < corners.length; j += 1) {
              segments.push([corners[j], corners[(j + 1) % corners.length]]);
            }
          }
          for (const [[ax, ay], [bx, by]] of segments) {
            const dx = bx - ax;
            const dy = by - ay;
            const lengthSq = dx * dx + dy * dy;
            const ratio = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
            const nearX = ax + ratio * dx;
            const nearY = ay + ratio * dy;
            if (Math.hypot(px - nearX, py - nearY) <= threshold) return stroke;
          }
          continue;
        }
        for (let j = 0; j < stroke.points.length; j += 1) {
          const [ax, ay] = this.toPx(stroke.points[j]);
          if (Math.hypot(px - ax, py - ay) <= threshold) return stroke;
          if (j === 0) continue;
          const [bx, by] = this.toPx(stroke.points[j - 1]);
          const dx = bx - ax;
          const dy = by - ay;
          const lengthSq = dx * dx + dy * dy;
          const ratio = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
          const nearX = ax + ratio * dx;
          const nearY = ay + ratio * dy;
          if (Math.hypot(px - nearX, py - nearY) <= threshold) return stroke;
        }
      }
      return null;
    }

    beginSelection(x, y, pointerType = 'mouse') {
      hidePenCursor();
      let hit = this.hitTestStroke(x, y, pointerType);
      if (!hit && this.selectionIds.size) {
        const bounds = this.getSelectionBounds();
        const margin = pointerType === 'touch' || pointerType === 'pen' ? 0.04 : 0.015;
        if (bounds.found
          && x >= bounds.minX - margin && x <= bounds.maxX + margin
          && y >= bounds.minY - margin && y <= bounds.maxY + margin) {
          hit = this.byId.get(this.selectionIds.values().next().value) || null;
        }
      }
      if (hit) {
        if (!this.selectionIds.has(hit.id)) this.selectionIds = new Set([hit.id]);
        const before = new Map();
        for (const id of this.selectionIds) {
          const stroke = this.byId.get(id);
          if (stroke?.points?.length) before.set(id, stroke.points.map((point) => [...point]));
        }
        const bounds = this.getSelectionBounds(this.selectionIds);
        this.selectionDrag = {
          mode: 'move',
          start: [x, y],
          before,
          bounds,
          dx: 0,
          dy: 0,
        };
        this.canvas.classList.add('is-dragging');
      } else {
        this.selectionIds.clear();
        this.selectionDrag = {
          mode: 'marquee',
          start: [x, y],
          last: [x, y],
          rect: { minX: x, minY: y, maxX: x, maxY: y },
        };
      }
      this.renderAll();
    }

    updateSelection(x, y) {
      const drag = this.selectionDrag;
      if (!drag) return;
      if (drag.mode === 'marquee') {
        drag.last = [x, y];
        drag.rect = {
          minX: Math.min(drag.start[0], x),
          minY: Math.min(drag.start[1], y),
          maxX: Math.max(drag.start[0], x),
          maxY: Math.max(drag.start[1], y),
        };
        this.renderAll();
        return;
      }
      const rawDx = x - drag.start[0];
      const rawDy = y - drag.start[1];
      const dx = Math.max(-drag.bounds.minX, Math.min(1 - drag.bounds.maxX, rawDx));
      const dy = Math.max(-drag.bounds.minY, Math.min(1 - drag.bounds.maxY, rawDy));
      drag.dx = dx;
      drag.dy = dy;
      for (const [id, points] of drag.before) {
        const stroke = this.byId.get(id);
        if (stroke) stroke.points = points.map(([px, py]) => [px + dx, py + dy]);
      }
      this.renderAll();
    }

    finishSelection(cancelled = false) {
      const drag = this.selectionDrag;
      this.selectionDrag = null;
      this.canvas.classList.remove('is-dragging');
      if (!drag) return;
      if (drag.mode === 'marquee') {
        const rect = drag.rect;
        this.selectionIds = new Set();
        if (Math.abs(rect.maxX - rect.minX) > 0.006 || Math.abs(rect.maxY - rect.minY) > 0.006) {
          for (const stroke of this.strokes) {
            if (stroke.kind || !stroke.points?.length) continue;
            const bounds = this.getSelectionBounds([stroke.id]);
            const intersects = bounds.maxX >= rect.minX && bounds.minX <= rect.maxX
              && bounds.maxY >= rect.minY && bounds.minY <= rect.maxY;
            if (intersects) this.selectionIds.add(stroke.id);
          }
        }
        this.renderAll();
        return;
      }
      if (cancelled) {
        for (const [id, points] of drag.before) {
          const stroke = this.byId.get(id);
          if (stroke) stroke.points = points;
        }
        this.renderAll();
        return;
      }
      if (Math.abs(drag.dx) > 0.0001 || Math.abs(drag.dy) > 0.0001) {
        this.strokes.push({ kind: 'move', ids: [...this.selectionIds], dx: drag.dx, dy: drag.dy, ended: true });
        send({ type: 'draw_move', ids: [...this.selectionIds], dx: drag.dx, dy: drag.dy });
      }
      this.renderAll();
    }

    clearSelection() {
      this.selectionIds.clear();
      this.selectionDrag = null;
      this.activePointerId = null;
      this.canvas.classList.remove('is-dragging');
      this.renderAll();
    }

    moveStrokes(ids, dx, dy) {
      const selected = new Set(ids);
      for (const stroke of this.strokes) {
        if (!selected.has(stroke.id) || stroke.kind || !stroke.points?.length) continue;
        stroke.points = stroke.points.map(([x, y]) => [
          Math.min(1, Math.max(0, x + dx)),
          Math.min(1, Math.max(0, y + dy)),
        ]);
      }
    }

    undoLast() {
      for (let i = this.strokes.length - 1; i >= 0; i -= 1) {
        const item = this.strokes[i];
        if (item.kind === 'move') {
          this.moveStrokes(item.ids, -item.dx, -item.dy);
          this.strokes.splice(i, 1);
          return true;
        }
        if (item.kind === 'fill') {
          this.strokes.splice(i, 1);
          return true;
        }
        if (item.ended) {
          this.strokes.splice(i, 1);
          this.byId.delete(item.id);
          return true;
        }
      }
      return false;
    }

    undo() {
      if (this.active) return;
      if (!this.undoLast()) return;
      this.renderAll();
      send({ type: 'draw_undo' });
    }

    clear() {
      this.reset();
      send({ type: 'draw_clear' });
    }

    replay(events) {
      this.replaying = true;
      this.reset();
      for (const ev of events) this.applyEvent(ev);
      this.replaying = false;
    }

    applyEvent(ev) {
      // 自己刚画的内容已经在本地实时渲染，跳过服务器回显
      if (!this.replaying && ev.from === state.playerId) return;

      if (ev.kind === 'begin') {
        if (this.byId.has(ev.id)) return;
        const stroke = {
          id: ev.id,
          color: ev.color,
          size: ev.size,
          tool: ev.tool,
          points: [[ev.x, ev.y]],
          ended: false,
          rendered: 0,
        };
        this.strokes.push(stroke);
        this.byId.set(ev.id, stroke);
        this.renderStroke(stroke);
        if (!this.replaying) {
          updateRemotePenCursor(ev.from, [ev.x, ev.y]);
          if (ev.tool !== 'eraser') spawnRemotePenStartEffect(ev.from, [ev.x, ev.y]);
        }
        return;
      }

      if (ev.kind === 'points') {
        const stroke = this.byId.get(ev.id);
        if (!stroke) return;
        if (isShapeTool(stroke.tool)) {
          const point = ev.points?.[ev.points.length - 1];
          if (Array.isArray(point)) {
            stroke.points = [stroke.points[0], [point[0], point[1]]];
            stroke.rendered = 0;
            this.renderAll();
          }
          if (!this.replaying && ev.points?.length) {
            updateRemotePenCursor(ev.from, ev.points[ev.points.length - 1]);
          }
          return;
        }
        const before = stroke.points.length;
        for (const pt of ev.points) stroke.points.push([pt[0], pt[1]]);
        if (stroke.points.length > before) this.renderStroke(stroke);
        if (!this.replaying && ev.points.length) {
          const point = ev.points[ev.points.length - 1];
          updateRemotePenCursor(ev.from, point);
          if (stroke.tool !== 'eraser') {
            const player = playerById(ev.from);
            const skin = player ? (PEN_SKIN_BY_ID.get(player.penSkinId) || PEN_SKIN_BY_ID.get('classic-pencil')) : null;
            spawnPenTrailEffect(skin, point, stroke.points[Math.max(0, stroke.points.length - 2)]);
          }
        }
        return;
      }

      if (ev.kind === 'end') {
        const stroke = this.byId.get(ev.id);
        if (stroke) stroke.ended = true;
        if (!this.replaying) {
          if (stroke && stroke.tool !== 'eraser') {
            spawnRemotePenEndEffect(ev.from, stroke.points[stroke.points.length - 1]);
          }
          hideRemotePenCursor();
        }
        return;
      }

      if (ev.kind === 'fill') {
        this.strokes.push({
          id: ev.id || `f_${Date.now().toString(36)}`,
          kind: 'fill',
          x: Math.min(1, Math.max(0, Number(ev.x) || 0)),
          y: Math.min(1, Math.max(0, Number(ev.y) || 0)),
          color: /^#[0-9a-fA-F]{6}$/.test(String(ev.color || '')) ? ev.color : '#111827',
          ended: true,
        });
        this.renderAll();
        return;
      }

      if (ev.kind === 'move') {
        const ids = Array.isArray(ev.ids) ? ev.ids.slice(0, 128).map((id) => String(id).slice(0, 80)) : [];
        const dx = Math.min(1, Math.max(-1, Number(ev.dx) || 0));
        const dy = Math.min(1, Math.max(-1, Number(ev.dy) || 0));
        if (!ids.length || (!dx && !dy)) return;
        this.moveStrokes(ids, dx, dy);
        this.strokes.push({ kind: 'move', ids, dx, dy, ended: true });
        this.renderAll();
        return;
      }

      if (ev.kind === 'undo') {
        this.undoLast();
        this.renderAll();
        if (!this.replaying) hideRemotePenCursor();
        return;
      }

      if (ev.kind === 'clear') {
        this.reset();
      }
    }
  }

  const board = new Board($('#board'));

  // ---------- 工具函数 ----------
  function canDraw() {
    if (state.phase === 'relay_draw') {
      return state.connected && !state.paused;
    }
    return state.connected
      && state.phase === 'drawing'
      && !state.paused
      && state.drawerId === state.playerId;
  }

  function skinAssetUrl(skin) {
    return `/assets/pen-skins/${encodeURIComponent(skin.asset)}`;
  }

  function selectedPenSkin() {
    return PEN_SKIN_BY_ID.get(penCollection.selected) || PEN_SKIN_BY_ID.get('classic-pencil');
  }

  function positionPenCursor(element, skin, x, y) {
    if (!element) return;
    const size = element.offsetWidth || 64;
    const anchor = PEN_CURSOR_ANCHORS[skin?.id] || PEN_CURSOR_ANCHOR_DEFAULT;
    element.style.left = `${x - anchor[0] * size}px`;
    element.style.top = `${y - anchor[1] * size}px`;
  }

  function updatePenSkinButton() {
    const skin = selectedPenSkin();
    const button = $('#penSkinToolBtn');
    if (button) {
      button.textContent = `🖊️ ${skin.name}`;
      button.title = `当前：${skin.name} · 打开笔皮肤收藏`;
    }
  }

  function setPenCursorSkin(id, { notifyRoom = false } = {}) {
    const skin = PEN_SKIN_BY_ID.get(id) || PEN_SKIN_BY_ID.get('classic-pencil');
    penCollection.selected = skin.id;
    brush.skin = skin.id;
    if (state.you) state.you.penSkinId = skin.id;
    const localPlayer = state.players.find((player) => player.id === state.playerId);
    if (localPlayer) localPlayer.penSkinId = skin.id;
    if (penCursor.image) {
      penCursor.image.src = skinAssetUrl(skin);
      penCursor.image.alt = `${skin.name}笔尖`;
    }
    if (penCursor.element) {
      penCursor.element.classList.toggle('paimon-pen-cursor', isPaimonPenSkin(skin));
      penCursor.element.classList.toggle('pikachu-pen-cursor', isPikachuPenSkin(skin));
      penCursor.element.classList.toggle('miku-pen-cursor', isMikuPenSkin(skin));
      penCursor.element.classList.toggle('teto-pen-cursor', isTetoPenSkin(skin));
      penCursor.element.classList.toggle('voxel-pen-cursor', isVoxelPenSkin(skin));
      penCursor.element.classList.toggle('dragon-pen-cursor', isDragonPenSkin(skin));
      penCursor.element.classList.toggle('infinity-edge-pen-cursor', isInfinityEdgePenSkin(skin));
      penCursor.element.classList.toggle('fire-kylin-pen-cursor', isFireKylinPenSkin(skin));
      penCursor.element.classList.toggle('bocchi-pen-cursor', isBocchiPenSkin(skin));
      penCursor.element.classList.toggle('kuuga-pen-cursor', isKuugaPenSkin(skin));
      penCursor.element.classList.toggle('whale-pen-cursor', isWhalePenSkin(skin));
      penCursor.element.classList.toggle('luo-tianyi-pen-cursor', isLuoTianyiPenSkin(skin));
      penCursor.element.classList.toggle('eva-pen-cursor', isEvaPenSkin(skin));
      penCursor.element.classList.toggle('snowking-pen-cursor', isSnowkingPenSkin(skin));
      penCursor.element.classList.toggle('persona3-pen-cursor', isPersona3PenSkin(skin));
    }
    updatePenSkinButton();
    if (notifyRoom) send({ type: 'set_pen_skin', skinId: skin.id });
  }

  function hidePenCursor() {
    if (penCursor.element) penCursor.element.classList.add('hidden');
    const canvas = $('#board');
    if (canvas) canvas.classList.remove('pen-cursor-active');
  }

  function hideRemotePenCursor() {
    if (remotePenCursor.element) remotePenCursor.element.classList.add('hidden');
    remotePenCursor.playerId = null;
  }

  function isPaimonPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'paimon-stardust');
  }

  function isPikachuPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'pikachu-voltage');
  }

  function isMikuPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'miku-chorus');
  }

  function isTetoPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'teto-rhythm');
  }

  function isVoxelPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'voxel-trail');
  }

  function isDragonPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'dragon-flame');
  }

  function isInfinityEdgePenSkin(skin) {
    return Boolean(skin && skin.effectId === 'infinity-edge-crit');
  }

  function isFireKylinPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'fire-kylin-flame');
  }

  function isBocchiPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'bocchi-stage');
  }

  function isKuugaPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'kuuga-seal');
  }

  function isWhalePenSkin(skin) {
    return Boolean(skin && skin.effectId === 'whale-tide');
  }

  function isLuoTianyiPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'luo-tianyi-resonance');
  }

  function isEvaPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'eva-awakening');
  }

  function isSnowkingPenSkin(skin) {
    return Boolean(skin && skin.effectId === 'snowking-frost');
  }

  function isPersona3PenSkin(skin) {
    return Boolean(skin && skin.effectId === 'persona3-arcana');
  }

  function playerUsesPaimonSkin(playerId) {
    const player = playerById(playerId);
    const skin = player ? PEN_SKIN_BY_ID.get(player.penSkinId) : null;
    return isPaimonPenSkin(skin);
  }

  function playerUsesVoxelPenSkin(playerId) {
    const player = playerById(playerId);
    const skin = player ? PEN_SKIN_BY_ID.get(player.penSkinId) : null;
    return isVoxelPenSkin(skin);
  }

  function clearPenEffects() {
    const layer = $('#penEffectLayer');
    if (layer) layer.replaceChildren();
  }

  function spawnPaimonStardust(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 34) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-paimon-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });
    const specs = phase === 'end'
      ? [
        { glyph: '✦', dx: -24, dy: -22, scale: 1.05, delay: 0 },
        { glyph: '✧', dx: 24, dy: -13, scale: 0.86, delay: 70 },
        { glyph: '⋆', dx: 18, dy: 20, scale: 0.76, delay: 130 },
        { glyph: '✦', dx: -17, dy: 25, scale: 0.68, delay: 180 },
        { glyph: '✧', dx: -4, dy: -31, scale: 0.56, delay: 230 },
      ]
      : [
        { glyph: '✦', dx: -17, dy: -19, scale: 0.88, delay: 0 },
        { glyph: '✧', dx: 19, dy: -10, scale: 0.72, delay: 55 },
        { glyph: '⋆', dx: 12, dy: 17, scale: 0.62, delay: 110 },
        { glyph: '✦', dx: -12, dy: 19, scale: 0.58, delay: 150 },
      ];
    for (const spec of specs) {
      const item = document.createElement('span');
      item.className = `pen-effect-star ${phase}`;
      item.textContent = spec.glyph;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--star-scale', String(spec.scale));
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnPikachuVoltageBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 42) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-pikachu-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-pikachu-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const specs = phase === 'end'
      ? [
        { dx: -34, dy: -24, size: 10, rotation: -36, color: '#fde047', delay: 0 },
        { dx: 34, dy: -18, size: 10, rotation: 31, color: '#38bdf8', delay: 38 },
        { dx: 31, dy: 14, size: 9, rotation: 57, color: '#facc15', delay: 78 },
        { dx: 11, dy: 34, size: 8, rotation: 76, color: '#60a5fa', delay: 118 },
        { dx: -20, dy: 31, size: 9, rotation: -64, color: '#f97316', delay: 158 },
        { dx: -37, dy: 8, size: 8, rotation: -26, color: '#fef08a', delay: 198 },
        { dx: -18, dy: -37, size: 7, rotation: -12, color: '#22d3ee', delay: 238 },
      ]
      : [
        { dx: -23, dy: -18, size: 8, rotation: -31, color: '#fde047', delay: 0 },
        { dx: 24, dy: -12, size: 8, rotation: 26, color: '#38bdf8', delay: 38 },
        { dx: 18, dy: 18, size: 7, rotation: 53, color: '#facc15', delay: 78 },
        { dx: -18, dy: 21, size: 7, rotation: -55, color: '#60a5fa', delay: 118 },
        { dx: -27, dy: 3, size: 6, rotation: -24, color: '#f97316', delay: 158 },
      ];
    for (const spec of specs) {
      const item = document.createElement('span');
      item.className = `pen-effect-pikachu-spark ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--spark-size', `${spec.size}px`);
      item.style.setProperty('--spark-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--spark-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnMikuChorusBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 44) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-miku-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const wave = document.createElement('span');
    wave.className = `pen-effect-miku-wave ${phase}`;
    wave.style.left = `${x * 100}%`;
    wave.style.top = `${y * 100}%`;
    layer.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });

    const notes = phase === 'end'
      ? [
        { glyph: '♫', dx: -36, dy: -22, scale: 1.1, rotation: -22, color: '#22d3ee', delay: 0 },
        { glyph: '♪', dx: 35, dy: -20, scale: 1.02, rotation: 18, color: '#f472b6', delay: 42 },
        { glyph: '♬', dx: 30, dy: 15, scale: .9, rotation: 46, color: '#67e8f9', delay: 84 },
        { glyph: '♪', dx: 11, dy: 35, scale: .82, rotation: 70, color: '#f9a8d4', delay: 126 },
        { glyph: '♫', dx: -19, dy: 31, scale: .94, rotation: -58, color: '#38bdf8', delay: 168 },
        { glyph: '♪', dx: -37, dy: 8, scale: .78, rotation: -30, color: '#f472b6', delay: 212 },
      ]
      : [
        { glyph: '♪', dx: -24, dy: -18, scale: .9, rotation: -18, color: '#22d3ee', delay: 0 },
        { glyph: '♫', dx: 24, dy: -13, scale: .84, rotation: 16, color: '#f472b6', delay: 42 },
        { glyph: '♪', dx: 17, dy: 18, scale: .74, rotation: 42, color: '#67e8f9', delay: 84 },
        { glyph: '♫', dx: -18, dy: 21, scale: .7, rotation: -48, color: '#f9a8d4', delay: 126 },
      ];
    for (const spec of notes) {
      const item = document.createElement('span');
      item.className = `pen-effect-miku-note ${phase}`;
      item.textContent = spec.glyph;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--note-scale', String(spec.scale));
      item.style.setProperty('--note-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--note-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnTetoRhythmBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 44) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-teto-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-teto-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const notes = phase === 'end'
      ? [
        { glyph: '♫', dx: -35, dy: -22, scale: 1.08, rotation: -24, color: '#fb7185', delay: 0 },
        { glyph: '♪', dx: 36, dy: -18, scale: 1.02, rotation: 20, color: '#fda4af', delay: 42 },
        { glyph: '♩', dx: 30, dy: 15, scale: .92, rotation: 48, color: '#f43f5e', delay: 84 },
        { glyph: '♫', dx: 12, dy: 35, scale: .84, rotation: 72, color: '#fecdd3', delay: 126 },
        { glyph: '♪', dx: -20, dy: 31, scale: .94, rotation: -58, color: '#e11d48', delay: 168 },
        { glyph: '♩', dx: -38, dy: 8, scale: .8, rotation: -30, color: '#f97316', delay: 212 },
      ]
      : [
        { glyph: '♪', dx: -23, dy: -18, scale: .9, rotation: -19, color: '#fb7185', delay: 0 },
        { glyph: '♫', dx: 24, dy: -13, scale: .84, rotation: 17, color: '#fda4af', delay: 42 },
        { glyph: '♩', dx: 17, dy: 18, scale: .74, rotation: 43, color: '#f43f5e', delay: 84 },
        { glyph: '♪', dx: -18, dy: 21, scale: .7, rotation: -49, color: '#fecdd3', delay: 126 },
      ];
    for (const spec of notes) {
      const item = document.createElement('span');
      item.className = `pen-effect-teto-note ${phase}`;
      item.textContent = spec.glyph;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--note-scale', String(spec.scale));
      item.style.setProperty('--note-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--note-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const spikes = phase === 'end'
      ? [
        { dx: -22, dy: -39, size: 8, rotation: -34, color: '#e11d48', delay: 20 },
        { dx: 25, dy: -35, size: 7, rotation: 30, color: '#fb7185', delay: 66 },
        { dx: 40, dy: 2, size: 7, rotation: 58, color: '#f97316', delay: 112 },
        { dx: 20, dy: 38, size: 8, rotation: 84, color: '#fda4af', delay: 158 },
        { dx: -27, dy: 37, size: 7, rotation: -66, color: '#be123c', delay: 204 },
        { dx: -42, dy: -2, size: 6, rotation: -36, color: '#fecdd3', delay: 250 },
      ]
      : [
        { dx: -15, dy: -28, size: 6, rotation: -28, color: '#e11d48', delay: 18 },
        { dx: 22, dy: -24, size: 5, rotation: 24, color: '#fb7185', delay: 60 },
        { dx: 29, dy: 5, size: 5, rotation: 54, color: '#f97316', delay: 104 },
        { dx: 13, dy: 28, size: 6, rotation: 78, color: '#fda4af', delay: 148 },
        { dx: -28, dy: 12, size: 5, rotation: -32, color: '#be123c', delay: 192 },
      ];
    for (const spec of spikes) {
      const item = document.createElement('span');
      item.className = `pen-effect-teto-spike ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--spike-size', `${spec.size}px`);
      item.style.setProperty('--spike-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--spike-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnDragonFlameBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 34) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-dragon-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });
    const specs = phase === 'end'
      ? [
        { dx: -27, dy: -22, size: 12, rotation: -28, color: '#fbbf24', delay: 0 },
        { dx: 28, dy: -15, size: 12, rotation: 25, color: '#ef4444', delay: 55 },
        { dx: 29, dy: 10, size: 9, rotation: 42, color: '#f97316', delay: 105 },
        { dx: 13, dy: 28, size: 8, rotation: 64, color: '#facc15', delay: 150 },
        { dx: -13, dy: 30, size: 10, rotation: -58, color: '#dc2626', delay: 195 },
        { dx: -31, dy: 11, size: 9, rotation: -42, color: '#f59e0b', delay: 245 },
        { dx: -22, dy: -7, size: 8, rotation: -18, color: '#fb7185', delay: 290 },
      ]
      : [
        { dx: -20, dy: -17, size: 9, rotation: -25, color: '#fbbf24', delay: 0 },
        { dx: 21, dy: -10, size: 9, rotation: 22, color: '#ef4444', delay: 55 },
        { dx: 17, dy: 18, size: 7, rotation: 42, color: '#f97316', delay: 105 },
        { dx: -17, dy: 20, size: 8, rotation: -50, color: '#facc15', delay: 150 },
        { dx: -25, dy: 3, size: 7, rotation: -25, color: '#dc2626', delay: 200 },
      ];
    for (const spec of specs) {
      const item = document.createElement('span');
      item.className = `pen-effect-dragon-ember ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--ember-size', `${spec.size}px`);
      item.style.setProperty('--ember-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--ember-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnEvaAwakeningBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 40) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-eva-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-eva-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const specs = phase === 'end'
      ? [
        { dx: -31, dy: -23, size: 8, rotation: -38, color: '#a855f7', delay: 0 },
        { dx: 32, dy: -17, size: 9, rotation: 31, color: '#a3e635', delay: 42 },
        { dx: 28, dy: 16, size: 7, rotation: 58, color: '#f97316', delay: 86 },
        { dx: 9, dy: 33, size: 8, rotation: 72, color: '#84cc16', delay: 128 },
        { dx: -18, dy: 30, size: 7, rotation: -62, color: '#c084fc', delay: 170 },
        { dx: -34, dy: 8, size: 8, rotation: -28, color: '#fb923c', delay: 214 },
        { dx: -17, dy: -32, size: 6, rotation: 12, color: '#bef264', delay: 254 },
      ]
      : [
        { dx: -22, dy: -17, size: 7, rotation: -34, color: '#a855f7', delay: 0 },
        { dx: 23, dy: -12, size: 7, rotation: 28, color: '#a3e635', delay: 42 },
        { dx: 17, dy: 18, size: 6, rotation: 54, color: '#f97316', delay: 84 },
        { dx: -17, dy: 21, size: 6, rotation: -56, color: '#84cc16', delay: 126 },
        { dx: -25, dy: 4, size: 5, rotation: -22, color: '#c084fc', delay: 168 },
      ];
    for (const spec of specs) {
      const item = document.createElement('span');
      item.className = `pen-effect-eva-shard ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--shard-size', `${spec.size}px`);
      item.style.setProperty('--shard-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--shard-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnSnowkingFrostBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 40) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-snowking-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-snowking-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const specs = phase === 'end'
      ? [
        { dx: -31, dy: -22, size: 9, rotation: -32, color: '#ef4444', delay: 0 },
        { dx: 31, dy: -17, size: 8, rotation: 28, color: '#bae6fd', delay: 45 },
        { dx: 29, dy: 15, size: 8, rotation: 54, color: '#facc15', delay: 88 },
        { dx: 12, dy: 32, size: 7, rotation: 70, color: '#e0f2fe', delay: 132 },
        { dx: -18, dy: 30, size: 8, rotation: -54, color: '#dc2626', delay: 176 },
        { dx: -35, dy: 7, size: 7, rotation: -18, color: '#fef08a', delay: 220 },
      ]
      : [
        { dx: -22, dy: -16, size: 7, rotation: -28, color: '#ef4444', delay: 0 },
        { dx: 23, dy: -11, size: 7, rotation: 24, color: '#bae6fd', delay: 44 },
        { dx: 17, dy: 18, size: 6, rotation: 52, color: '#facc15', delay: 86 },
        { dx: -17, dy: 21, size: 6, rotation: -52, color: '#e0f2fe', delay: 128 },
      ];
    for (const spec of specs) {
      const item = document.createElement('span');
      item.className = `pen-effect-snowking-ice ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--ice-size', `${spec.size}px`);
      item.style.setProperty('--ice-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--ice-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnInfinityEdgeCritBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 44) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));

    const core = document.createElement('span');
    core.className = `pen-effect-infinity-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-infinity-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const slashes = phase === 'end'
      ? [
        { dx: -20, dy: -18, length: 50, rotation: -38, delay: 0, color: '#fff7c2' },
        { dx: 21, dy: -10, length: 43, rotation: 34, delay: 54, color: '#fbbf24' },
        { dx: 19, dy: 18, length: 38, rotation: 58, delay: 108, color: '#ef4444' },
        { dx: -17, dy: 22, length: 42, rotation: -52, delay: 162, color: '#f59e0b' },
        { dx: -29, dy: 4, length: 33, rotation: -22, delay: 216, color: '#fecaca' },
      ]
      : [
        { dx: -15, dy: -13, length: 39, rotation: -36, delay: 0, color: '#fff7c2' },
        { dx: 17, dy: -8, length: 34, rotation: 31, delay: 52, color: '#fbbf24' },
        { dx: 14, dy: 15, length: 30, rotation: 56, delay: 104, color: '#ef4444' },
        { dx: -14, dy: 18, length: 33, rotation: -49, delay: 156, color: '#f59e0b' },
      ];
    for (const spec of slashes) {
      const item = document.createElement('span');
      item.className = `pen-effect-infinity-slash ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--slash-length', `${spec.length}px`);
      item.style.setProperty('--slash-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--slash-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const sparks = phase === 'end'
      ? [
        { dx: -34, dy: -25, size: 9, rotation: -15, color: '#fde68a', delay: 18 },
        { dx: 34, dy: -19, size: 8, rotation: 24, color: '#fef08a', delay: 68 },
        { dx: 31, dy: 14, size: 8, rotation: 52, color: '#f87171', delay: 118 },
        { dx: 13, dy: 34, size: 7, rotation: 76, color: '#fbbf24', delay: 168 },
        { dx: -23, dy: 32, size: 8, rotation: -61, color: '#fca5a5', delay: 218 },
        { dx: -39, dy: 7, size: 6, rotation: -30, color: '#fff7c2', delay: 268 },
      ]
      : [
        { dx: -25, dy: -19, size: 7, rotation: -14, color: '#fde68a', delay: 18 },
        { dx: 24, dy: -13, size: 6, rotation: 24, color: '#fef08a', delay: 62 },
        { dx: 20, dy: 17, size: 6, rotation: 52, color: '#f87171', delay: 106 },
        { dx: -19, dy: 22, size: 6, rotation: -58, color: '#fbbf24', delay: 150 },
      ];
    for (const spec of sparks) {
      const item = document.createElement('span');
      item.className = `pen-effect-infinity-spark ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--spark-size', `${spec.size}px`);
      item.style.setProperty('--spark-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--spark-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnFireKylinFlameBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 46) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));

    const core = document.createElement('span');
    core.className = `pen-effect-fire-kylin-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-fire-kylin-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const flames = phase === 'end'
      ? [
        { dx: -32, dy: -24, length: 46, rotation: -36, delay: 0, color: '#f97316' },
        { dx: 34, dy: -17, length: 50, rotation: 27, delay: 48, color: '#facc15' },
        { dx: 29, dy: 17, length: 44, rotation: 56, delay: 96, color: '#ef4444' },
        { dx: 9, dy: 35, length: 41, rotation: 78, delay: 144, color: '#fb923c' },
        { dx: -24, dy: 31, length: 42, rotation: -62, delay: 192, color: '#fbbf24' },
        { dx: -41, dy: 5, length: 35, rotation: -22, delay: 240, color: '#f87171' },
      ]
      : [
        { dx: -24, dy: -18, length: 36, rotation: -34, delay: 0, color: '#f97316' },
        { dx: 25, dy: -12, length: 39, rotation: 25, delay: 48, color: '#facc15' },
        { dx: 19, dy: 18, length: 34, rotation: 53, delay: 96, color: '#ef4444' },
        { dx: -19, dy: 22, length: 32, rotation: -56, delay: 144, color: '#fb923c' },
      ];
    for (const spec of flames) {
      const item = document.createElement('span');
      item.className = `pen-effect-fire-kylin-flame ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--flame-length', `${spec.length}px`);
      item.style.setProperty('--flame-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--flame-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const sparks = phase === 'end'
      ? [
        { dx: -34, dy: -30, size: 10, rotation: -18, color: '#fff7c2', delay: 18 },
        { dx: 35, dy: -22, size: 8, rotation: 24, color: '#fde68a', delay: 66 },
        { dx: 32, dy: 13, size: 9, rotation: 54, color: '#fb923c', delay: 114 },
        { dx: 13, dy: 37, size: 8, rotation: 78, color: '#facc15', delay: 162 },
        { dx: -23, dy: 34, size: 8, rotation: -62, color: '#fca5a5', delay: 210 },
        { dx: -40, dy: 7, size: 7, rotation: -30, color: '#fed7aa', delay: 258 },
      ]
      : [
        { dx: -25, dy: -22, size: 8, rotation: -18, color: '#fff7c2', delay: 18 },
        { dx: 25, dy: -15, size: 7, rotation: 24, color: '#fde68a', delay: 62 },
        { dx: 21, dy: 17, size: 7, rotation: 52, color: '#fb923c', delay: 106 },
        { dx: -19, dy: 23, size: 7, rotation: -58, color: '#facc15', delay: 150 },
      ];
    for (const spec of sparks) {
      const item = document.createElement('span');
      item.className = `pen-effect-fire-kylin-spark ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--spark-size', `${spec.size}px`);
      item.style.setProperty('--spark-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--spark-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnPersona3ArcanaBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 44) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const core = document.createElement('span');
    core.className = `pen-effect-persona3-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-persona3-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const cards = phase === 'end'
      ? [
        { dx: -34, dy: -22, rotation: -36, scale: 1.12, color: '#38bdf8', delay: 0 },
        { dx: 34, dy: -18, rotation: 29, scale: 1.04, color: '#c4b5fd', delay: 42 },
        { dx: 31, dy: 15, rotation: 54, scale: .92, color: '#facc15', delay: 84 },
        { dx: 12, dy: 34, rotation: 78, scale: .88, color: '#60a5fa', delay: 126 },
        { dx: -19, dy: 31, rotation: -62, scale: .95, color: '#fde68a', delay: 168 },
        { dx: -36, dy: 8, rotation: -24, scale: .86, color: '#818cf8', delay: 210 },
      ]
      : [
        { dx: -23, dy: -17, rotation: -31, scale: .92, color: '#38bdf8', delay: 0 },
        { dx: 24, dy: -12, rotation: 25, scale: .84, color: '#c4b5fd', delay: 42 },
        { dx: 18, dy: 18, rotation: 49, scale: .76, color: '#facc15', delay: 84 },
        { dx: -17, dy: 21, rotation: -55, scale: .72, color: '#60a5fa', delay: 126 },
      ];
    for (const spec of cards) {
      const item = document.createElement('span');
      item.className = `pen-effect-persona3-card ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--card-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--card-scale', String(spec.scale));
      item.style.setProperty('--card-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const moons = phase === 'end'
      ? [
        { dx: -18, dy: -39, size: 7, rotation: -22, delay: 22 },
        { dx: 25, dy: -33, size: 6, rotation: 26, delay: 68 },
        { dx: 39, dy: 2, size: 6, rotation: 55, delay: 112 },
        { dx: 20, dy: 37, size: 7, rotation: 84, delay: 154 },
        { dx: -26, dy: 38, size: 6, rotation: -67, delay: 198 },
        { dx: -41, dy: -3, size: 5, rotation: -35, delay: 242 },
      ]
      : [
        { dx: -14, dy: -28, size: 5, rotation: -18, delay: 18 },
        { dx: 21, dy: -24, size: 5, rotation: 24, delay: 60 },
        { dx: 29, dy: 5, size: 5, rotation: 52, delay: 104 },
        { dx: 13, dy: 28, size: 5, rotation: 78, delay: 146 },
        { dx: -27, dy: 12, size: 4, rotation: -32, delay: 188 },
      ];
    for (const spec of moons) {
      const item = document.createElement('span');
      item.className = `pen-effect-persona3-moon ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--moon-size', `${spec.size}px`);
      item.style.setProperty('--moon-rotation', `${spec.rotation}deg`);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnBocchiStageBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 48) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));

    const core = document.createElement('span');
    core.className = `pen-effect-bocchi-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-bocchi-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const waves = phase === 'end'
      ? [
        { dx: -35, dy: -20, width: 44, rotation: -26, color: '#f472b6', delay: 0 },
        { dx: 35, dy: -12, width: 52, rotation: 24, color: '#38bdf8', delay: 58 },
        { dx: 30, dy: 18, width: 38, rotation: 52, color: '#c084fc', delay: 116 },
        { dx: -21, dy: 27, width: 48, rotation: -54, color: '#facc15', delay: 174 },
        { dx: -38, dy: 8, width: 34, rotation: -8, color: '#67e8f9', delay: 232 },
      ]
      : [
        { dx: -23, dy: -14, width: 34, rotation: -23, color: '#f472b6', delay: 0 },
        { dx: 24, dy: -8, width: 38, rotation: 22, color: '#38bdf8', delay: 54 },
        { dx: 18, dy: 16, width: 30, rotation: 49, color: '#c084fc', delay: 108 },
        { dx: -17, dy: 20, width: 32, rotation: -52, color: '#facc15', delay: 162 },
      ];
    for (const spec of waves) {
      const item = document.createElement('span');
      item.className = `pen-effect-bocchi-wave ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--wave-width', `${spec.width}px`);
      item.style.setProperty('--wave-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--wave-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const accents = phase === 'end'
      ? [
        { glyph: '♪', dx: -28, dy: -38, size: 18, color: '#f472b6', delay: 18 },
        { glyph: '♫', dx: 27, dy: -31, size: 16, color: '#38bdf8', delay: 76 },
        { glyph: '…', dx: 39, dy: 4, size: 18, color: '#facc15', delay: 134 },
        { glyph: '✦', dx: -37, dy: 15, size: 14, color: '#c084fc', delay: 192 },
      ]
      : [
        { glyph: '♪', dx: -21, dy: -27, size: 14, color: '#f472b6', delay: 18 },
        { glyph: '♫', dx: 22, dy: -22, size: 13, color: '#38bdf8', delay: 66 },
        { glyph: '…', dx: 28, dy: 7, size: 15, color: '#facc15', delay: 114 },
      ];
    for (const spec of accents) {
      const item = document.createElement('span');
      item.className = `pen-effect-bocchi-note ${phase}`;
      item.textContent = spec.glyph;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--note-size', `${spec.size}px`);
      item.style.setProperty('--note-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnKuugaSealBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 48) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));

    const core = document.createElement('span');
    core.className = `pen-effect-kuuga-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-kuuga-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const glyphs = phase === 'end'
      ? [
        { glyph: '◇', dx: -38, dy: -19, size: 16, rotation: -28, delay: 0 },
        { glyph: 'ᛉ', dx: 35, dy: -27, size: 18, rotation: 24, delay: 52 },
        { glyph: '✦', dx: 40, dy: 11, size: 14, rotation: 58, delay: 104 },
        { glyph: '◇', dx: 19, dy: 37, size: 13, rotation: 82, delay: 156 },
        { glyph: 'ᛉ', dx: -29, dy: 33, size: 16, rotation: -62, delay: 208 },
        { glyph: '✦', dx: -42, dy: 5, size: 12, rotation: -34, delay: 260 },
      ]
      : [
        { glyph: '◇', dx: -24, dy: -15, size: 13, rotation: -24, delay: 0 },
        { glyph: 'ᛉ', dx: 24, dy: -17, size: 15, rotation: 22, delay: 54 },
        { glyph: '✦', dx: 26, dy: 17, size: 12, rotation: 54, delay: 108 },
        { glyph: '◇', dx: -20, dy: 22, size: 11, rotation: -54, delay: 162 },
      ];
    for (const spec of glyphs) {
      const item = document.createElement('span');
      item.className = `pen-effect-kuuga-glyph ${phase}`;
      item.textContent = spec.glyph;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--glyph-size', `${spec.size}px`);
      item.style.setProperty('--glyph-rotation', `${spec.rotation}deg`);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnWhaleTideBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 48) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));

    const core = document.createElement('span');
    core.className = `pen-effect-whale-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-whale-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const bubbles = phase === 'end'
      ? [
        { dx: -36, dy: -25, size: 10, delay: 0, color: '#bae6fd' },
        { dx: 30, dy: -28, size: 8, delay: 46, color: '#93c5fd' },
        { dx: 42, dy: 4, size: 7, delay: 92, color: '#e0f2fe' },
        { dx: 20, dy: 31, size: 9, delay: 138, color: '#c4b5fd' },
        { dx: -21, dy: 35, size: 7, delay: 184, color: '#7dd3fc' },
        { dx: -42, dy: 8, size: 8, delay: 230, color: '#e0f2fe' },
      ]
      : [
        { dx: -24, dy: -17, size: 8, delay: 0, color: '#bae6fd' },
        { dx: 24, dy: -18, size: 7, delay: 48, color: '#93c5fd' },
        { dx: 27, dy: 12, size: 6, delay: 96, color: '#e0f2fe' },
        { dx: -20, dy: 22, size: 7, delay: 144, color: '#c4b5fd' },
      ];
    for (const spec of bubbles) {
      const item = document.createElement('span');
      item.className = `pen-effect-whale-bubble ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--bubble-size', `${spec.size}px`);
      item.style.setProperty('--bubble-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const waves = phase === 'end'
      ? [
        { dx: -35, dy: -12, width: 42, rotation: -28, delay: 18, color: '#60a5fa' },
        { dx: 35, dy: -8, width: 48, rotation: 24, delay: 70, color: '#bae6fd' },
        { dx: 25, dy: 22, width: 38, rotation: 56, delay: 122, color: '#a5b4fc' },
        { dx: -28, dy: 26, width: 44, rotation: -58, delay: 174, color: '#7dd3fc' },
      ]
      : [
        { dx: -24, dy: -10, width: 32, rotation: -24, delay: 18, color: '#60a5fa' },
        { dx: 25, dy: -6, width: 36, rotation: 22, delay: 68, color: '#bae6fd' },
        { dx: 18, dy: 18, width: 30, rotation: 50, delay: 118, color: '#a5b4fc' },
      ];
    for (const spec of waves) {
      const item = document.createElement('span');
      item.className = `pen-effect-whale-wave ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--wave-width', `${spec.width}px`);
      item.style.setProperty('--wave-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--wave-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const whales = phase === 'end'
      ? [
        { dx: -20, dy: -40, size: 19, rotation: -18, delay: 28, color: '#bfdbfe' },
        { dx: 34, dy: -25, size: 17, rotation: 24, delay: 92, color: '#c4b5fd' },
        { dx: 30, dy: 23, size: 15, rotation: 54, delay: 156, color: '#bae6fd' },
      ]
      : [
        { dx: -20, dy: -28, size: 16, rotation: -18, delay: 28, color: '#bfdbfe' },
        { dx: 25, dy: 5, size: 14, rotation: 36, delay: 92, color: '#c4b5fd' },
      ];
    for (const spec of whales) {
      const item = document.createElement('span');
      item.className = `pen-effect-whale-glyph ${phase}`;
      item.textContent = '◒';
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--glyph-size', `${spec.size}px`);
      item.style.setProperty('--glyph-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--glyph-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnLuoTianyiResonanceBurst(point, phase = 'start') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 48) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));

    const core = document.createElement('span');
    core.className = `pen-effect-luo-core ${phase}`;
    core.style.left = `${x * 100}%`;
    core.style.top = `${y * 100}%`;
    layer.appendChild(core);
    core.addEventListener('animationend', () => core.remove(), { once: true });

    const ring = document.createElement('span');
    ring.className = `pen-effect-luo-ring ${phase}`;
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const waves = phase === 'end'
      ? [
        { dx: -38, dy: -22, width: 52, rotation: -28, delay: 0, color: '#22d3ee' },
        { dx: 38, dy: -14, width: 48, rotation: 24, delay: 52, color: '#67e8f9' },
        { dx: 31, dy: 17, width: 44, rotation: 56, delay: 104, color: '#a5b4fc' },
        { dx: 10, dy: 37, width: 40, rotation: 78, delay: 156, color: '#facc15' },
        { dx: -26, dy: 32, width: 46, rotation: -58, delay: 208, color: '#c4b5fd' },
        { dx: -43, dy: 5, width: 38, rotation: -18, delay: 260, color: '#7dd3fc' },
      ]
      : [
        { dx: -25, dy: -15, width: 40, rotation: -25, delay: 0, color: '#22d3ee' },
        { dx: 25, dy: -9, width: 36, rotation: 22, delay: 54, color: '#67e8f9' },
        { dx: 20, dy: 17, width: 32, rotation: 51, delay: 108, color: '#a5b4fc' },
        { dx: -18, dy: 22, width: 34, rotation: -52, delay: 162, color: '#facc15' },
      ];
    for (const spec of waves) {
      const item = document.createElement('span');
      item.className = `pen-effect-luo-wave ${phase}`;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--wave-width', `${spec.width}px`);
      item.style.setProperty('--wave-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--wave-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }

    const notes = phase === 'end'
      ? [
        { glyph: '♪', dx: -29, dy: -38, size: 18, rotation: -18, delay: 18, color: '#67e8f9' },
        { glyph: '♫', dx: 30, dy: -31, size: 17, rotation: 24, delay: 76, color: '#c4b5fd' },
        { glyph: '✦', dx: 39, dy: 4, size: 15, rotation: 52, delay: 134, color: '#facc15' },
        { glyph: '♪', dx: 22, dy: 34, size: 16, rotation: 78, delay: 192, color: '#22d3ee' },
        { glyph: '✧', dx: -38, dy: 14, size: 14, rotation: -32, delay: 250, color: '#e0f2fe' },
      ]
      : [
        { glyph: '♪', dx: -23, dy: -28, size: 15, rotation: -18, delay: 18, color: '#67e8f9' },
        { glyph: '♫', dx: 24, dy: -21, size: 14, rotation: 24, delay: 66, color: '#c4b5fd' },
        { glyph: '✦', dx: 28, dy: 8, size: 13, rotation: 52, delay: 114, color: '#facc15' },
        { glyph: '♪', dx: -22, dy: 21, size: 13, rotation: -54, delay: 162, color: '#22d3ee' },
      ];
    for (const spec of notes) {
      const item = document.createElement('span');
      item.className = `pen-effect-luo-note ${phase}`;
      item.textContent = spec.glyph;
      item.style.left = `${x * 100}%`;
      item.style.top = `${y * 100}%`;
      item.style.setProperty('--dx', `${spec.dx}px`);
      item.style.setProperty('--dy', `${spec.dy}px`);
      item.style.setProperty('--note-size', `${spec.size}px`);
      item.style.setProperty('--note-rotation', `${spec.rotation}deg`);
      item.style.setProperty('--note-color', spec.color);
      item.style.animationDelay = `${spec.delay}ms`;
      layer.appendChild(item);
      item.addEventListener('animationend', () => item.remove(), { once: true });
    }
  }

  function spawnPenStartEffect(skin, point) {
    if (isPaimonPenSkin(skin)) spawnPaimonStardust(point, 'start');
    else if (isPikachuPenSkin(skin)) spawnPikachuVoltageBurst(point, 'start');
    else if (isMikuPenSkin(skin)) spawnMikuChorusBurst(point, 'start');
    else if (isTetoPenSkin(skin)) spawnTetoRhythmBurst(point, 'start');
    else if (isPersona3PenSkin(skin)) spawnPersona3ArcanaBurst(point, 'start');
    else if (isVoxelPenSkin(skin)) spawnVoxelBlockBurst(point, 'start');
    else if (isDragonPenSkin(skin)) spawnDragonFlameBurst(point, 'start');
    else if (isInfinityEdgePenSkin(skin)) spawnInfinityEdgeCritBurst(point, 'start');
    else if (isFireKylinPenSkin(skin)) spawnFireKylinFlameBurst(point, 'start');
    else if (isBocchiPenSkin(skin)) spawnBocchiStageBurst(point, 'start');
    else if (isKuugaPenSkin(skin)) spawnKuugaSealBurst(point, 'start');
    else if (isWhalePenSkin(skin)) spawnWhaleTideBurst(point, 'start');
    else if (isLuoTianyiPenSkin(skin)) spawnLuoTianyiResonanceBurst(point, 'start');
    else if (isEvaPenSkin(skin)) spawnEvaAwakeningBurst(point, 'start');
    else if (isSnowkingPenSkin(skin)) spawnSnowkingFrostBurst(point, 'start');
  }

  function spawnPenEndEffect(skin, point) {
    if (isPaimonPenSkin(skin)) spawnPaimonStardust(point, 'end');
    else if (isPikachuPenSkin(skin)) spawnPikachuVoltageBurst(point, 'end');
    else if (isMikuPenSkin(skin)) spawnMikuChorusBurst(point, 'end');
    else if (isTetoPenSkin(skin)) spawnTetoRhythmBurst(point, 'end');
    else if (isPersona3PenSkin(skin)) spawnPersona3ArcanaBurst(point, 'end');
    else if (isVoxelPenSkin(skin)) spawnVoxelBlockBurst(point, 'end');
    else if (isDragonPenSkin(skin)) spawnDragonFlameBurst(point, 'end');
    else if (isInfinityEdgePenSkin(skin)) spawnInfinityEdgeCritBurst(point, 'end');
    else if (isFireKylinPenSkin(skin)) spawnFireKylinFlameBurst(point, 'end');
    else if (isBocchiPenSkin(skin)) spawnBocchiStageBurst(point, 'end');
    else if (isKuugaPenSkin(skin)) spawnKuugaSealBurst(point, 'end');
    else if (isWhalePenSkin(skin)) spawnWhaleTideBurst(point, 'end');
    else if (isLuoTianyiPenSkin(skin)) spawnLuoTianyiResonanceBurst(point, 'end');
    else if (isEvaPenSkin(skin)) spawnEvaAwakeningBurst(point, 'end');
    else if (isSnowkingPenSkin(skin)) spawnSnowkingFrostBurst(point, 'end');
  }

  function spawnRemotePenStartEffect(playerId, point) {
    const player = playerById(playerId);
    const skin = player ? PEN_SKIN_BY_ID.get(player.penSkinId) : null;
    spawnPenStartEffect(skin, point);
  }

  function spawnRemotePenEndEffect(playerId, point) {
    const player = playerById(playerId);
    const skin = player ? PEN_SKIN_BY_ID.get(player.penSkinId) : null;
    spawnPenEndEffect(skin, point);
  }

  const penTrailLastAt = new Map();

  function spawnPenTrailEffect(skin, point, previousPoint = null) {
    const profile = skin ? PEN_TRAIL_PROFILES[skin.id] : null;
    const layer = $('#penEffectLayer');
    if (!profile || !layer || !Array.isArray(point) || layer.children.length >= 78) return;
    const now = performance.now();
    const lastAt = penTrailLastAt.get(skin.id) || 0;
    if (now - lastAt < profile.interval) return;
    penTrailLastAt.set(skin.id, now);

    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const prevX = Array.isArray(previousPoint) ? Number(previousPoint[0]) : x - 0.001;
    const prevY = Array.isArray(previousPoint) ? Number(previousPoint[1]) : y;
    const rawDx = x - prevX;
    const rawDy = y - prevY;
    const heading = Math.abs(rawDx) + Math.abs(rawDy) > 0.0001
      ? Math.atan2(rawDy, rawDx) * 180 / Math.PI
      : randomFloat() * 360;
    const radians = heading * Math.PI / 180;
    const jitter = (randomFloat() - 0.5) * 8;
    const drift = profile.distance + randomFloat() * 5;
    const item = document.createElement('span');
    item.className = `pen-effect-trail pen-effect-trail-${profile.kind}`;
    if (profile.glyph) item.textContent = profile.glyph;
    item.style.left = `${x * 100}%`;
    item.style.top = `${y * 100}%`;
    item.style.setProperty('--trail-color', profile.color);
    item.style.setProperty('--trail-accent', profile.accent);
    item.style.setProperty('--trail-size', `${profile.size * (0.82 + randomFloat() * 0.36)}px`);
    item.style.setProperty('--trail-angle', `${heading + (randomFloat() - 0.5) * 18}deg`);
    item.style.setProperty('--trail-dx', `${(-Math.cos(radians) * drift + jitter).toFixed(2)}px`);
    item.style.setProperty('--trail-dy', `${(-Math.sin(radians) * drift + jitter).toFixed(2)}px`);
    item.style.setProperty('--trail-life', `${420 + Math.round(randomFloat() * 180)}ms`);
    item.style.setProperty('--trail-rotation', `${Math.round((randomFloat() - 0.5) * 90)}deg`);
    layer.appendChild(item);
    item.addEventListener('animationend', () => item.remove(), { once: true });
  }

  function spawnVoxelParticle(point, spec, phase = 'trail') {
    const layer = $('#penEffectLayer');
    if (!layer || !Array.isArray(point) || layer.children.length >= 44) return;
    const x = Math.min(1, Math.max(0, Number(point[0]) || 0));
    const y = Math.min(1, Math.max(0, Number(point[1]) || 0));
    const item = document.createElement('span');
    item.className = `pen-effect-voxel ${phase}`;
    item.style.left = `${x * 100}%`;
    item.style.top = `${y * 100}%`;
    item.style.setProperty('--dx', `${spec.dx}px`);
    item.style.setProperty('--dy', `${spec.dy}px`);
    item.style.setProperty('--voxel-size', `${spec.size}px`);
    item.style.setProperty('--voxel-color', spec.color);
    item.style.setProperty('--voxel-rotation', `${spec.rotation}deg`);
    layer.appendChild(item);
    item.addEventListener('animationend', () => item.remove(), { once: true });
  }

  function spawnVoxelTrail(point) {
    const colors = ['#22d3ee', '#38bdf8', '#a3e635', '#facc15'];
    spawnVoxelParticle(point, {
      dx: -3 + Math.round(randomFloat() * 6),
      dy: -5 - Math.round(randomFloat() * 5),
      size: 3 + Math.round(randomFloat() * 3),
      rotation: Math.round(randomFloat() * 90 - 45),
      color: randomPick(colors),
    }, 'trail');
  }

  function spawnVoxelBlockBurst(point, phase = 'start') {
    const specs = phase === 'end'
      ? [
        { dx: -15, dy: -13, size: 7, rotation: -18, color: '#22d3ee' },
        { dx: 14, dy: -8, size: 6, rotation: 26, color: '#a3e635' },
        { dx: 10, dy: 14, size: 5, rotation: 45, color: '#facc15' },
        { dx: -8, dy: 16, size: 4, rotation: -35, color: '#38bdf8' },
      ]
      : [
        { dx: -9, dy: -11, size: 5, rotation: -22, color: '#a3e635' },
        { dx: 10, dy: -7, size: 4, rotation: 25, color: '#22d3ee' },
        { dx: 4, dy: 10, size: 4, rotation: 42, color: '#facc15' },
      ];
    for (const spec of specs) spawnVoxelParticle(point, spec, phase);
  }

  function updateRemotePenCursor(playerId, point) {
    const isDrawingPhase = state.phase === 'drawing' || state.phase === 'relay_draw';
    if (!remotePenCursor.element || !isDrawingPhase || !playerId || playerId === state.playerId
      || (state.drawerId && playerId !== state.drawerId) || !Array.isArray(point)) {
      hideRemotePenCursor();
      return;
    }
    const player = playerById(playerId);
    const skin = player ? (PEN_SKIN_BY_ID.get(player.penSkinId) || PEN_SKIN_BY_ID.get('classic-pencil')) : null;
    const canvas = $('#board');
    if (!skin || !canvas) {
      hideRemotePenCursor();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, point[0] * rect.width));
    const y = Math.min(rect.height, Math.max(0, point[1] * rect.height));
    positionPenCursor(remotePenCursor.element, skin, x, y);
    remotePenCursor.element.classList.toggle('paimon-pen-cursor', isPaimonPenSkin(skin));
    remotePenCursor.element.classList.toggle('pikachu-pen-cursor', isPikachuPenSkin(skin));
    remotePenCursor.element.classList.toggle('miku-pen-cursor', isMikuPenSkin(skin));
    remotePenCursor.element.classList.toggle('teto-pen-cursor', isTetoPenSkin(skin));
    remotePenCursor.element.classList.toggle('voxel-pen-cursor', isVoxelPenSkin(skin));
    remotePenCursor.element.classList.toggle('dragon-pen-cursor', isDragonPenSkin(skin));
    remotePenCursor.element.classList.toggle('infinity-edge-pen-cursor', isInfinityEdgePenSkin(skin));
    remotePenCursor.element.classList.toggle('fire-kylin-pen-cursor', isFireKylinPenSkin(skin));
    remotePenCursor.element.classList.toggle('bocchi-pen-cursor', isBocchiPenSkin(skin));
    remotePenCursor.element.classList.toggle('kuuga-pen-cursor', isKuugaPenSkin(skin));
    remotePenCursor.element.classList.toggle('whale-pen-cursor', isWhalePenSkin(skin));
    remotePenCursor.element.classList.toggle('luo-tianyi-pen-cursor', isLuoTianyiPenSkin(skin));
    remotePenCursor.element.classList.toggle('eva-pen-cursor', isEvaPenSkin(skin));
    remotePenCursor.element.classList.toggle('snowking-pen-cursor', isSnowkingPenSkin(skin));
    remotePenCursor.element.classList.toggle('persona3-pen-cursor', isPersona3PenSkin(skin));
    if (remotePenCursor.image.dataset.skinId !== skin.id) {
      remotePenCursor.image.src = skinAssetUrl(skin);
      remotePenCursor.image.alt = `${player.nickname}使用的${skin.name}`;
      remotePenCursor.image.dataset.skinId = skin.id;
    }
    remotePenCursor.playerId = playerId;
    remotePenCursor.element.classList.remove('hidden');
  }

  function updatePenCursor(canvas, event) {
    if (!penCursor.element || !canDraw()) {
      hidePenCursor();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    positionPenCursor(penCursor.element, selectedPenSkin(), x, y);
    penCursor.element.classList.remove('hidden');
    canvas.classList.add('pen-cursor-active');
  }

  function randomFloat() {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] / 0x100000000;
    }
    return Math.random();
  }

  function randomPick(items) {
    return items[Math.floor(randomFloat() * items.length)] || null;
  }

  function pickDrawSkin(wantedRarity) {
    const pool = PEN_SKINS.filter((skin) => skin.rarity !== 'free');
    const missing = pool.filter((skin) => !penCollection.owned.includes(skin.id));
    const wantedMissing = missing.filter((skin) => skin.rarity === wantedRarity);
    if (wantedMissing.length) return randomPick(wantedMissing);
    if (missing.length) return randomPick(missing);
    const wanted = pool.filter((skin) => skin.rarity === wantedRarity);
    return randomPick(wanted.length ? wanted : pool);
  }

  function rollPenSkin() {
    const nextDraw = penCollection.totalDraws + 1;
    const missing = PEN_SKINS.filter((skin) => skin.rarity !== 'free' && !penCollection.owned.includes(skin.id));
    let skin;
    if (penCollection.pityLegendary >= 59) {
      skin = pickDrawSkin('legendary');
    } else if (missing.length && nextDraw % 60 === 0) {
      skin = randomPick(missing);
    } else {
      let wantedRarity;
      if (penCollection.pityEpic >= 29) wantedRarity = 'epic';
      else if (penCollection.pityRare >= 9) wantedRarity = randomFloat() < 0.68 ? 'rare' : 'epic';
      else {
        const roll = randomFloat();
        wantedRarity = roll < 0.03
          ? 'legendary'
          : (roll < 0.55 ? 'common' : (roll < 0.85 ? 'rare' : 'epic'));
      }
      skin = pickDrawSkin(wantedRarity);
    }
    if (!skin) return null;

    penCollection.totalDraws = nextDraw;
    const duplicate = penCollection.owned.includes(skin.id);
    let fragmentsGained = 0;
    if (duplicate) {
      fragmentsGained = PEN_RARITY_META[skin.rarity].fragments;
      penCollection.fragments += fragmentsGained;
    } else {
      penCollection.owned.push(skin.id);
    }

    if (skin.rarity === 'legendary') {
      penCollection.pityRare = 0;
      penCollection.pityEpic = 0;
      penCollection.pityLegendary = 0;
    } else if (skin.rarity === 'epic') {
      penCollection.pityRare = 0;
      penCollection.pityEpic = 0;
      penCollection.pityLegendary = Math.min(59, penCollection.pityLegendary + 1);
    } else if (skin.rarity === 'rare') {
      penCollection.pityRare = 0;
      penCollection.pityEpic = Math.min(29, penCollection.pityEpic + 1);
      penCollection.pityLegendary = Math.min(59, penCollection.pityLegendary + 1);
    } else {
      penCollection.pityRare = Math.min(9, penCollection.pityRare + 1);
      penCollection.pityEpic = Math.min(29, penCollection.pityEpic + 1);
      penCollection.pityLegendary = Math.min(59, penCollection.pityLegendary + 1);
    }
    return { skin, duplicate, fragmentsGained };
  }

  function drawPenSkins(count) {
    const amount = Math.max(1, Math.floor(count));
    const bonusDraws = Math.min(penCollection.bonusDraws, amount);
    const paidDraws = amount - bonusDraws;
    if (!PEN_LOCAL_TEST_MODE && penCollection.stardust < paidDraws) {
      const available = penCollection.stardust + bonusDraws;
      toast(`抽数不够，还差 ${amount - available} 次`, 'error');
      return [];
    }
    if (!PEN_LOCAL_TEST_MODE) {
      penCollection.bonusDraws -= bonusDraws;
      penCollection.stardust -= paidDraws;
    }
    const results = [];
    for (let i = 0; i < amount; i += 1) {
      const result = rollPenSkin();
      if (result) results.push(result);
    }
    savePenCollection();
    return results;
  }

  function penDrawButtonText() {
    if (PEN_LOCAL_TEST_MODE) return '开启一箱 · 无限测试';
    if (penCollection.bonusDraws > 0) return `开启一箱 · 赠送抽数优先（${penCollection.bonusDraws}）`;
    return '开启一箱 · 1 星尘';
  }

  function updatePenGachaDialogCounters() {
    const dust = document.querySelector('[data-pen-currency="stardust"]');
    const fragments = document.querySelector('[data-pen-currency="fragments"]');
    const bonus = document.querySelector('[data-pen-currency="bonus-draws"]');
    if (dust) dust.textContent = `✨ 涂鸦星尘 ${penCollection.stardust}`;
    if (fragments) fragments.textContent = `🧩 笔芯碎片 ${penCollection.fragments}`;
    if (bonus) bonus.textContent = `🎁 赠送抽数 ${penCollection.bonusDraws}`;
    document.querySelectorAll('[data-pen-gacha-draw-button]').forEach((button) => {
      if (penGachaOpening) return;
      button.textContent = penDrawButtonText();
      button.disabled = !PEN_LOCAL_TEST_MODE
        && penCollection.stardust + penCollection.bonusDraws < 1;
    });
  }

  function handlePenGachaGrant(msg) {
    const amount = Math.floor(Number(msg?.amount));
    if (!Number.isFinite(amount) || amount < 1) return;
    penCollection.bonusDraws = clampInteger(penCollection.bonusDraws + amount, 0, 9999);
    savePenCollection();
    updatePenGachaDialogCounters();
    showGachaGrantAnnouncement(msg);
    const senderNickname = String(msg?.senderNickname || 'localhost 用户').trim() || 'localhost 用户';
    const text = `给全员发放了 ${amount} 抽`;
    toast(`🎁 ${senderNickname} ${text}`, 'ok');
  }

  function awardPenStardust(amount, key, reason = '完成游戏') {
    const reward = Math.max(0, Math.floor(Number(amount) || 0));
    if (!reward || (key && penCollection.rewardKeys.includes(key))) return false;
    if (key) {
      penCollection.rewardKeys.push(key);
      penCollection.rewardKeys = penCollection.rewardKeys.slice(-80);
    }
    penCollection.stardust += reward;
    savePenCollection();
    toast(`✨ ${reason}，获得 ${reward} 点涂鸦星尘`, 'ok');
    return true;
  }

  function send(obj) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(obj));
    }
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  function toast(text, type = '') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  const lastToastAt = new Map();

  // 同一类提示在窗口内只弹一次：画手跨过回合切换时每个画笔包都会带一条拒绝，逐条弹窗会盖住画面
  function toastOnce(key, text, type = '', windowMs = 3000) {
    const now = Date.now();
    if (now - (lastToastAt.get(key) || 0) < windowMs) return;
    lastToastAt.set(key, now);
    toast(text, type);
  }

  function showScreen(name) {
    $('#screen-home').classList.toggle('hidden', name !== 'home');
    $('#screen-lobby').classList.toggle('hidden', name !== 'lobby');
    $('#screen-game').classList.toggle('hidden', name !== 'game');
    $('#topbar').classList.toggle('hidden', name === 'home');
  }

  function updateConnState() {
    const el = $('#connState');
    if (state.connected) {
      el.textContent = '已连接';
      el.classList.add('on');
    } else {
      el.textContent = state.roomCode ? '连接中…' : '未连接';
      el.classList.remove('on');
    }
  }

  // 移动端输入法会改变 visual viewport，而不一定改变 layout viewport。
  // 把可视高度和键盘占用高度交给 CSS，避免画板/提示被键盘盖住。
  function updateViewportMetrics() {
    const viewport = window.visualViewport;
    const layoutHeight = window.innerHeight;
    const visualHeight = viewport ? viewport.height : layoutHeight;
    const offsetTop = viewport ? viewport.offsetTop : 0;
    const keyboardInset = Math.max(0, layoutHeight - (visualHeight + offsetTop));
    const heightDrop = Math.max(0, layoutHeight - visualHeight);
    const keyboardOpen = keyboardInset > 80 || heightDrop > 140;

    document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(visualHeight)}px`);
    document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(keyboardInset)}px`);
    document.body.classList.toggle('ime-open', keyboardOpen);
  }

  function bindViewportMetrics() {
    window.addEventListener('resize', updateViewportMetrics);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportMetrics);
      window.visualViewport.addEventListener('scroll', updateViewportMetrics);
    }
    updateViewportMetrics();
  }

  function playerById(id) {
    return state.players.find((p) => p.id === id) || null;
  }

  function drawerName() {
    const p = playerById(state.drawerId);
    return p ? p.nickname : '--';
  }

  function saveCredentials() {
    if (!state.roomCode) return;
    localStorage.setItem('dg_nickname', state.nickname);
    localStorage.setItem('dg_last_room', state.roomCode);
    localStorage.setItem(`dg_player_${state.roomCode}`, JSON.stringify({
      playerId: state.playerId,
      token: state.token,
      nickname: state.nickname,
    }));
  }

  function loadCredentials(code) {
    try {
      return JSON.parse(localStorage.getItem(`dg_player_${code}`) || 'null');
    } catch {
      return null;
    }
  }

  function clearCredentials() {
    if (state.roomCode) localStorage.removeItem(`dg_player_${state.roomCode}`);
  }

  // ---------- 大厅渲染 ----------
  function syncConfigUI() {
    const cfg = state.room || {};
    $('#wordModeSelect').value = cfg.wordMode || 'choice';
    $('#roundsSelect').value = String(cfg.rounds || 3);
    $('#secondsSelect').value = String(cfg.drawSeconds || 80);
    $('#customWordsInput').value = (cfg.customWords || [])
      .map((w) => (typeof w === 'string' ? w : (w.hint ? `${w.word}|${w.hint}` : w.word)))
      .join(String.fromCharCode(10));
    $('#customOnlyCheck').checked = Boolean(cfg.customOnly);
    $('#gameModeSelect').value = cfg.gameMode || 'classic';
    $('#relayPassesSelect').value = String(cfg.relayPasses || 4);
    $('#guessSecondsSelect').value = String(cfg.guessSeconds || 30);
    $('#relaySettings').classList.toggle('hidden', (cfg.gameMode || 'classic') !== 'relay');
    const packs = cfg.wordPacks || {};
    $('#basicPackCheck').checked = packs.basic !== false;
    $('#lolPackCheck').checked = Boolean(packs.lol);
    $('#palworldPackCheck').checked = Boolean(packs.palworld);
  }

  function renderLobby() {
    syncConfigUI();
    $('#lobbyCode').textContent = state.roomCode || '------';
    $('#topRoomCode').textContent = `房间码 ${state.roomCode || '----'}`;
    const qrImg = $('#qrImg');
    const qrBox = qrImg?.closest('.qr-box');
    const roomCode = String(state.roomCode || '').trim();
    const qrSrc = `/api/rooms/${encodeURIComponent(roomCode)}/qr.svg`;
    if (qrImg && roomCode && qrImg.dataset.src !== qrSrc) {
      qrImg.dataset.src = qrSrc;
      qrImg.dataset.qrRetry = '0';
      qrImg.alt = '房间二维码';
      qrBox?.classList.remove('qr-load-error');
      qrImg.onload = () => qrBox?.classList.remove('qr-load-error');
      qrImg.onerror = () => {
        // A room can appear before the first QR request reaches the server.
        // Retry once with a query string so a cached 404 cannot keep the QR blank.
        if (qrImg.dataset.qrRetry !== '1') {
          qrImg.dataset.qrRetry = '1';
          qrImg.src = `${qrSrc}?retry=1`;
          return;
        }
        qrImg.alt = '二维码加载失败，请使用下方链接加入';
        qrBox?.classList.add('qr-load-error');
      };
      qrImg.src = qrSrc;
    }
    $('#shareInput').value = state.shareUrl;
    $('#playerCount').textContent = state.players.length;

    const isHost = state.you && state.you.isHost;
    $('#hostPanel').classList.toggle('hidden', !isHost || state.phase !== 'waiting');
    $('#guestHint').classList.toggle('hidden', isHost);
    renderPlayerList();
  }

  function renderPlayerList() {
    renderPlayerListInto($('#playerList'), 'lobby');
    renderPlayerListInto($('#playerListGame'), 'game');
  }

  function renderPlayerListInto(ul, mode) {
    if (!ul) return;
    ul.innerHTML = '';
    for (const p of state.players) {
      const li = document.createElement('li');
      li.className = 'player-item';

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.style.background = `hsl(${p.avatarHue || 220} 65% 45%)`;
      avatar.textContent = p.nickname.slice(0, 1);

      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = p.nickname;
      if (p.isHost) name.insertAdjacentHTML('beforeend', ' <span class="badge">👑</span>');
      if (p.isDrawer) name.insertAdjacentHTML('beforeend', ' <span class="badge">🎨</span>');
      if (p.drawOrder > 0) name.insertAdjacentHTML('beforeend', ` <span class="badge order-badge">${p.drawOrder}</span>`);

      const score = document.createElement('span');
      score.className = 'player-score';
      score.textContent = String(p.score);

      const dot = document.createElement('span');
      dot.className = `online-dot ${p.online ? '' : 'off'}`;

      li.append(avatar, name, score, dot);

      if (mode === 'lobby' && state.you && state.you.isHost && state.phase === 'waiting' && p.id !== state.playerId) {
        const kick = document.createElement('button');
        kick.className = 'kick-btn';
        kick.textContent = '移出';
        kick.addEventListener('click', () => send({ type: 'kick', playerId: p.id }));
        li.appendChild(kick);
      }
      ul.appendChild(li);
    }
  }

  // ---------- 聊天渲染 ----------
  function addChat(msg) {
    const list = $('#chatList');
    const el = document.createElement('div');
    if (msg.system) {
      el.className = 'msg system';
      el.textContent = msg.text;
    } else {
      el.className = `msg ${msg.correct ? 'correct' : 'guess'}`;
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = `${msg.nickname}：`;
      el.appendChild(who);
      el.appendChild(document.createTextNode(msg.text));
    }
    list.appendChild(el);
    while (list.children.length > 200) list.firstChild.remove();
    list.scrollTop = list.scrollHeight;
  }

  function updateBulletUI() {
    const layer = $('#bulletLayer');
    const toggle = $('#bulletToggle');
    if (!layer || !toggle) return;
    layer.classList.toggle('off', !state.bulletsOn);
    toggle.classList.toggle('on', state.bulletsOn);
    toggle.textContent = state.bulletsOn ? '弹幕：开' : '弹幕：关';
  }

  function showThrowEffect(kind) {
    const layer = $('#fxLayer');
    if (!layer) return;
    const emojis = kind === 'flower'
      ? ['🌸', '💐', '🌷', '🌹']
      : kind === 'poop'
        ? ['💩']
        : ['🥦', '🍅', '🥕', '🥬'];
    const count = kind === 'poop' ? 4 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement('span');
      el.className = `fx-item${kind === 'poop' ? ' poop' : ''}`;
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = `${2 + Math.random() * 90}%`;
      el.style.fontSize = `${22 + Math.floor(Math.random() * 16)}px`;
      el.style.animationDuration = `${1.5 + Math.random() * 1.2}s`;
      el.style.animationDelay = `${Math.random() * 0.35}s`;
      layer.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  function showBullet(msg) {
    if (!state.bulletsOn) return;
    const layer = $('#bulletLayer');
    if (!layer || layer.classList.contains('off')) return;

    while (layer.children.length > 40) layer.firstChild.remove();

    const hue = msg.playerId ? (playerById(msg.playerId)?.avatarHue || 220) : 220;
    const el = document.createElement('div');
    el.className = 'bullet';
    el.textContent = msg.correct ? msg.text : `${msg.nickname}：${msg.text}`;
    el.style.color = msg.correct ? '#facc15' : `hsl(${hue} 85% 68%)`;
    el.style.top = `${6 + Math.random() * 72}%`;
    el.style.animationDuration = `${7 + Math.random() * 5}s`;
    layer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ---------- 游戏界面 ----------
  function updateGameUI() {
    const phase = state.phase;
    const isDrawer = state.drawerId === state.playerId;
    const drawerLabel = $('#drawerLabel');
    const drawerText = phase.startsWith('relay')
      ? `传画接龙 · 第 ${state.relayTask ? state.relayTask.step : '-'}/${state.room ? state.room.relayPasses : '-'} 棒`
      : `画手：${drawerName()}`;
    drawerLabel.textContent = drawerText;
    const drawer = playerById(state.drawerId);
    const drawerSkin = drawer ? (PEN_SKIN_BY_ID.get(drawer.penSkinId) || PEN_SKIN_BY_ID.get('classic-pencil')) : null;
    if (drawerSkin && (phase === 'drawing' || phase === 'relay_draw')) {
      const skinBadge = document.createElement('span');
      skinBadge.className = 'active-pen-skin';
      skinBadge.title = `当前画手笔皮肤：${drawerSkin.name}`;
      skinBadge.appendChild(createPenSkinImage(drawerSkin, 'active-pen-skin-image'));
      const skinName = document.createElement('span');
      skinName.textContent = drawerSkin.name;
      skinBadge.appendChild(skinName);
      drawerLabel.append(' ', skinBadge);
    }

    const privateBox = $('#privateWordBox');
    if (isDrawer && (phase === 'drawing' || phase === 'prepare') && state.privateWord) {
      privateBox.classList.remove('hidden');
      privateBox.textContent = `✏️ 你的题目：${state.privateWord}（${state.category}）`;
    } else {
      privateBox.classList.add('hidden');
    }

    $('#guessedBox').classList.toggle('hidden', !(state.you && state.you.guessed && phase === 'drawing'));

    const toolsVisible = (isDrawer && phase === 'drawing' && !state.paused) || phase === 'relay_draw';
    const drawerTools = $('#drawerTools');
    drawerTools.classList.toggle('hidden', !toolsVisible);
    const mobileToolToggle = $('#mobileToolToggle');
    if (mobileToolToggle) {
      mobileToolToggle.classList.toggle('hidden', !toolsVisible);
      if (!toolsVisible) {
        drawerTools.classList.remove('mobile-tools-collapsed');
        mobileToolToggle.setAttribute('aria-expanded', 'true');
        mobileToolToggle.textContent = '🎨 工具';
      }
    }
    $('#watcherHint').classList.toggle('hidden', !(phase === 'drawing' && !isDrawer));

    const overlay = $('#canvasOverlay');
    overlay.classList.add('hidden');
    overlay.textContent = '';
    if (phase === 'relay_intro') {
      overlay.textContent = '📞 传画接龙即将开始，每人先画自己的秘密词';
      overlay.classList.remove('hidden');
    } else if (phase === 'relay_draw') {
      overlay.textContent = '';
    } else if (phase === 'relay_guess') {
      overlay.textContent = '🔍 根据这幅画，猜一个词';
      overlay.classList.remove('hidden');
    } else if (phase === 'relay_collect') {
      overlay.textContent = '📦 正在收集缩略图…';
      overlay.classList.remove('hidden');
    } else if (phase === 'relay_reveal') {
      overlay.textContent = '🎉 揭晓时刻';
      overlay.classList.remove('hidden');
    } else if (phase === 'prepare') {
      if (state.choosing) {
        overlay.textContent = isDrawer ? '🎨 请从 3 个词中选择一个' : `🎨 ${drawerName()} 正在 3 选 1…`;
      } else {
        overlay.textContent = isDrawer ? '🎨 请记住题目，准备作画' : `🎨 ${drawerName()} 正在看题…`;
      }
      overlay.classList.remove('hidden');
    } else if (phase === 'drawing' && state.paused) {
      overlay.textContent = '⏸ 画手掉线，等待重连…';
      overlay.classList.remove('hidden');
    } else if (phase === 'result') {
      overlay.textContent = '✅ 公布答案';
      overlay.classList.remove('hidden');
    } else if (phase === 'finished') {
      overlay.textContent = '🏁 游戏结束';
      overlay.classList.remove('hidden');
    }

    $('#board').classList.toggle('disabled', !canDraw());
    if (!canDraw()) hidePenCursor();
    if (phase !== 'drawing' && phase !== 'relay_draw') hideRemotePenCursor();

    const input = $('#chatInput');
    const sendBtn = $('#sendBtn');
    const guessMode = phase === 'drawing' && !isDrawer && !state.guessed;
    if (phase === 'relay_guess') {
      input.disabled = false;
      input.placeholder = '根据这幅画猜一个词…';
      sendBtn.textContent = '提交';
    } else if (phase === 'relay_draw' || phase === 'relay_collect') {
      input.disabled = true;
      input.placeholder = '接龙进行中…';
      sendBtn.textContent = '发送';
    } else {
      input.placeholder = guessMode ? '输入答案…' : '聊天…';
      input.disabled = false;
      if (guessMode) sendBtn.textContent = '猜';
      else if (phase === 'drawing' && isDrawer) {
        input.placeholder = '画手聊天…';
        sendBtn.textContent = '发送';
      } else {
        sendBtn.textContent = '发送';
      }
    }

    updateTopText();
    updateDrawOrder();
    renderPlayerList();
  }

  function updateTopText() {
    $('#topRoomCode').textContent = `房间码 ${state.roomCode || '----'}`;
    if (state.room) {
      const r = state.room.round || 0;
      const tr = state.room.totalRounds || 0;
      const turn = state.room.turnInRound || 0;
      const players = state.room.playersPerRound || 0;
      $('#roundText').textContent = players > 0
        ? `第 ${r}/${tr} 轮 · 画手 ${turn}/${players}`
        : `第 ${r}/${tr} 轮`;
    } else {
      $('#roundText').textContent = '';
    }
    const phaseText = {
      waiting: '等待开始',
      prepare: state.choosing ? '画手选题中' : '画手看题中',
      drawing: state.paused ? '暂停等待重连' : '作画中',
      relay_intro: '传画接龙准备中',
      relay_draw: '秘密作画中',
      relay_guess: '看图猜词中',
      relay_collect: '收集缩略图中',
      relay_reveal: '揭晓时刻',
      result: '答案揭晓',
      finished: '游戏结束',
    };
    $('#phaseText').textContent = phaseText[state.phase] || state.phase;

    const word = $('#wordBanner');
    const hintLine = $('#hintLine');
    $('#wordText').textContent = '';
    const isDrawer = state.drawerId === state.playerId;
    if (state.phase === 'relay_draw' && state.relayTask) {
      if (state.relayTask.promptType === 'word') {
        word.textContent = `你的秘密词：${state.relayTask.promptWord}`;
        hintLine.textContent = `类别：${state.relayTask.promptCategory || '自定义'}，不要给别人看到`;
      } else {
        word.textContent = `请画出：${state.relayTask.promptGuess || ''}`;
        hintLine.textContent = '根据上一个人的猜测作画';
      }
    } else if (state.phase === 'relay_guess') {
      word.textContent = '看图猜词';
      hintLine.textContent = '你看到的是上一位玩家的画作';
    } else if (state.phase === 'relay_intro') {
      word.textContent = '传画接龙';
      hintLine.textContent = '每人先画自己的秘密词';
    } else if (state.phase === 'relay_collect') {
      word.textContent = '正在收集画作';
      hintLine.textContent = '';
    } else if (state.phase === 'relay_reveal') {
      word.textContent = '词语是怎么被传歪的？';
      hintLine.textContent = '';
    } else if (isDrawer && state.privateWord && (state.phase === 'drawing' || state.phase === 'prepare')) {
      word.textContent = `你的题目：${state.privateWord}`;
      hintLine.textContent = `类别：${state.category || '自定义'}`;
    } else if (state.phase === 'prepare' && state.choosing) {
      word.textContent = isDrawer ? '请选择题目' : '画手正在选题…';
      hintLine.textContent = '';
    } else if (state.phase === 'drawing' || state.phase === 'prepare') {
      word.textContent = `${state.wordMasked || ''}  ${state.wordDescription || ''}`;
      hintLine.textContent = state.hintText ? `提示：${state.hintText}` : '';
    } else if (state.phase === 'result') {
      word.textContent = `答案：${state.wordMasked || ''}`;
      hintLine.textContent = '';
    } else {
      word.textContent = '';
      hintLine.textContent = '';
    }
  }

  function updateDrawOrder() {
    const el = $('#drawOrderText');
    if (!el) return;
    const ordered = state.players
      .filter((p) => p.drawOrder > 0)
      .sort((a, b) => a.drawOrder - b.drawOrder);
    if (ordered.length > 1) {
      el.textContent = `作画顺序：${ordered.map((p) => `${p.drawOrder}.${p.nickname}`).join(' → ')}`;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  // ---------- 服务器时钟校准与计时 ----------
  function observeServerTime(serverTime) {
    if (typeof serverTime !== 'number') return;
    const sample = serverTime - Date.now();
    state.serverOffset = state.serverOffset === null
      ? sample
      : state.serverOffset * 0.7 + sample * 0.3;
  }

  function serverNow() {
    return Date.now() + (state.serverOffset || 0);
  }

  function updateTimer() {
    const el = $('#timerText');
    if (state.phase === 'drawing' && state.paused && state.pauseDeadline) {
      const left = Math.max(0, state.pauseDeadline - serverNow());
      el.textContent = `${Math.ceil(left / 1000)}s`;
      return;
    }
    if (state.phase.startsWith('relay') && state.phase !== 'relay_reveal' && state.deadline) {
      const left = Math.max(0, state.deadline - serverNow());
      el.textContent = `${Math.ceil(left / 1000)}s`;
      return;
    }
    if ((state.phase === 'drawing' || state.phase === 'prepare') && state.deadline) {
      const left = Math.max(0, state.deadline - serverNow());
      el.textContent = `${Math.ceil(left / 1000)}s`;
      return;
    }
    el.textContent = '--';

    const countdownEl = document.querySelector('.result-countdown');
    if (countdownEl && state.currentArtwork && state.phase === 'result' && state.resultEndsAt) {
      const left = Math.max(0, state.resultEndsAt - serverNow());
      countdownEl.textContent = state.currentArtwork.round >= (state.room?.totalRounds || 1) && state.currentArtwork.turnInRound >= (state.room?.playersPerRound || 1)
        ? `即将公布最终排名… ${Math.ceil(left / 1000)} 秒`
        : `即将开始下一轮… ${Math.ceil(left / 1000)} 秒`;
    }
  }

  setInterval(() => {
    updateTimer();
  }, 200);

  // 歌词随播放进度高亮
  setInterval(() => {
    updateLyricUI();
  }, 500);

  // ---------- 遮罩 ----------
  function showOverlay(contentEl) {
    const box = $('#overlayContent');
    box.innerHTML = '';
    box.appendChild(contentEl);
    $('#overlay').classList.remove('hidden');
  }

  function hideOverlay() {
    penGachaOpening = false;
    $('#overlay').classList.add('hidden');
  }

  function announceLegendaryDraw(skin) {
    if (!skin || skin.rarity !== 'legendary') return;
    const announceId = `${state.playerId || 'local'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const announcement = {
      skinId: skin.id,
      nickname: state.you?.nickname || state.nickname || '玩家',
      announceId,
    };
    // 未加入房间时没有广播目标，只在本机展示。
    if (!state.roomCode || !state.connected) {
      showLegendaryAnnouncement(announcement, { playSound: false });
      return;
    }
    // 先本机展示，再用同一个事件 ID发送到房间；服务端回声由统一接收路径处理并去重。
    showLegendaryAnnouncement(announcement, { playSound: true });
    send({ type: 'pen_legendary_announce', skinId: skin.id, announceId });
  }

  function showLegendaryAnnouncement(msg, { playSound = true } = {}) {
    const skin = PEN_SKIN_BY_ID.get(String(msg?.skinId || '').trim());
    if (!skin || skin.rarity !== 'legendary') return;
    const layer = $('#legendaryAnnouncement');
    if (!layer) return;
    const announceId = String(msg?.announceId || '').trim();
    if (announceId) {
      if (legendaryAnnouncementState.seen.has(announceId)) return;
      legendaryAnnouncementState.seen.add(announceId);
      if (legendaryAnnouncementState.seen.size > 100) {
        const oldest = legendaryAnnouncementState.seen.values().next().value;
        if (oldest) legendaryAnnouncementState.seen.delete(oldest);
      }
    }
    legendaryAnnouncementState.queue.push({
      skin,
      nickname: String(msg?.nickname || '玩家').trim().slice(0, 20) || '玩家',
      playSound,
    });
    if (!legendaryAnnouncementState.active) renderNextLegendaryAnnouncement();
  }

  function renderNextLegendaryAnnouncement() {
    const next = legendaryAnnouncementState.queue.shift();
    const layer = $('#legendaryAnnouncement');
    if (!next || !layer) {
      legendaryAnnouncementState.active = false;
      return;
    }
    legendaryAnnouncementState.active = true;
    const image = $('#legendaryAnnouncementImage');
    const player = $('#legendaryAnnouncementPlayer');
    const skin = $('#legendaryAnnouncementSkin');
    if (image) {
      image.src = skinAssetUrl(next.skin);
      image.alt = next.skin.name;
    }
    if (player) player.textContent = `${next.nickname} 抽中了`;
    if (skin) skin.textContent = next.skin.name;
    layer.classList.remove('hidden', 'is-visible');
    void layer.offsetWidth;
    layer.classList.add('is-visible');
    if (next.playSound) playGachaSfx('legendary', { rarity: 'legendary', volume: 0.52 });
    legendaryAnnouncementState.timer = window.setTimeout(() => dismissLegendaryAnnouncement(), 5200);
  }

  function dismissLegendaryAnnouncement({ clearQueue = false } = {}) {
    if (legendaryAnnouncementState.timer) {
      window.clearTimeout(legendaryAnnouncementState.timer);
      legendaryAnnouncementState.timer = null;
    }
    if (clearQueue) legendaryAnnouncementState.queue = [];
    const layer = $('#legendaryAnnouncement');
    if (layer) {
      layer.classList.remove('is-visible');
      layer.classList.add('hidden');
    }
    legendaryAnnouncementState.active = false;
    if (!clearQueue && legendaryAnnouncementState.queue.length) {
      window.setTimeout(() => renderNextLegendaryAnnouncement(), 180);
    }
  }

  function showGachaGrantAnnouncement(msg) {
    const amount = Math.floor(Number(msg?.amount));
    const layer = $('#gachaGrantAnnouncement');
    if (!layer || !Number.isFinite(amount) || amount < 1) return;
    gachaGrantAnnouncementState.queue.push({
      amount,
      senderId: String(msg?.senderId || ''),
      senderNickname: String(msg?.senderNickname || 'localhost 用户').trim().slice(0, 20) || 'localhost 用户',
      recipientCount: Math.max(1, Math.floor(Number(msg?.recipientCount) || 1)),
    });
    if (!gachaGrantAnnouncementState.active) renderNextGachaGrantAnnouncement();
  }

  function renderNextGachaGrantAnnouncement() {
    const next = gachaGrantAnnouncementState.queue.shift();
    const layer = $('#gachaGrantAnnouncement');
    if (!next || !layer) {
      gachaGrantAnnouncementState.active = false;
      return;
    }
    gachaGrantAnnouncementState.active = true;
    const isSelf = next.senderId && next.senderId === state.playerId;
    const kicker = $('#gachaGrantAnnouncementKicker');
    const message = $('#gachaGrantAnnouncementMessage');
    const meta = $('#gachaGrantAnnouncementMeta');
    if (kicker) kicker.textContent = isSelf ? '✦ 你发出的本局福利 ✦' : '✦ 本局福利弹幕 ✦';
    if (message) {
      message.textContent = isSelf
        ? `你为全员发放了 +${next.amount} 抽`
        : `${next.senderNickname} 为全员发放了 +${next.amount} 抽`;
    }
    if (meta) meta.textContent = `当前在线 ${next.recipientCount} 人可领取`;
    layer.classList.toggle('is-self', Boolean(isSelf));
    layer.classList.remove('hidden', 'is-visible');
    void layer.offsetWidth;
    layer.classList.add('is-visible');
    gachaGrantAnnouncementState.timer = window.setTimeout(() => dismissGachaGrantAnnouncement(), 4200);
  }

  function dismissGachaGrantAnnouncement({ clearQueue = false } = {}) {
    if (gachaGrantAnnouncementState.timer) {
      window.clearTimeout(gachaGrantAnnouncementState.timer);
      gachaGrantAnnouncementState.timer = null;
    }
    if (clearQueue) gachaGrantAnnouncementState.queue = [];
    const layer = $('#gachaGrantAnnouncement');
    if (layer) {
      layer.classList.remove('is-visible', 'is-self');
      layer.classList.add('hidden');
    }
    gachaGrantAnnouncementState.active = false;
    if (!clearQueue && gachaGrantAnnouncementState.queue.length) {
      window.setTimeout(() => renderNextGachaGrantAnnouncement(), 180);
    }
  }

  function createPenSkinImage(skin, className = 'pen-skin-image') {
    const image = document.createElement('img');
    image.className = className;
    image.src = skinAssetUrl(skin);
    image.alt = skin.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.fetchPriority = className === 'pen-skin-image' ? 'low' : 'high';
    // WebP 适合外网传输；如果用户使用非常旧的浏览器，自动退回原始 PNG。
    image.addEventListener('error', () => {
      if (image.dataset.fallbackSrc || !skin.asset.endsWith('.webp')) return;
      image.dataset.fallbackSrc = '1';
      image.src = `/assets/pen-skins/${encodeURIComponent(skin.asset.replace(/\.webp$/i, '.png'))}`;
    }, { once: true });
    return image;
  }

  function createPenSkinCard(skin, lastResults) {
    const owned = penCollection.owned.includes(skin.id);
    const selected = penCollection.selected === skin.id;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `pen-skin-card rarity-${PEN_RARITY_META[skin.rarity].className}`;
    card.classList.toggle('owned', owned);
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-label', `${skin.name}，${owned ? (selected ? '已装备' : '点击装备') : '未拥有'}`);

    const art = document.createElement('div');
    art.className = 'pen-skin-art';
    art.appendChild(createPenSkinImage(skin));
    const name = document.createElement('div');
    name.className = 'pen-skin-name';
    name.textContent = skin.name;
    const rarity = document.createElement('div');
    rarity.className = 'pen-skin-rarity';
    rarity.textContent = PEN_RARITY_META[skin.rarity].label;
    const status = document.createElement('div');
    status.className = 'pen-skin-status';
    status.textContent = selected ? '已装备' : (owned ? '点击装备' : '未拥有');
    card.append(art, name, rarity, status);
    card.addEventListener('click', () => {
      if (!owned) {
        toast(`还没有「${skin.name}」，先用涂鸦星尘抽取吧`);
        return;
      }
      penCollection.selected = skin.id;
      savePenCollection();
      setPenCursorSkin(skin.id, { notifyRoom: true });
      showPenSkinModal(lastResults);
    });
    return card;
  }

  function createCaseReelCard(skin, target = false) {
    const card = document.createElement('div');
    card.className = `pen-case-reel-card rarity-${PEN_RARITY_META[skin.rarity].className}`;
    card.classList.toggle('target', target);
    const art = document.createElement('div');
    art.className = 'pen-case-reel-art';
    const image = createPenSkinImage(skin, 'pen-case-reel-image');
    image.loading = 'eager';
    art.appendChild(image);
    const label = document.createElement('span');
    label.textContent = skin.name;
    card.append(art, label);
    return card;
  }

  function startPenCaseOpening(stage, button, result, wrap) {
    if (penGachaOpening || !result || !stage || !button) return;
    penGachaOpening = true;
    button.disabled = true;
    button.classList.add('is-opening');
    button.textContent = '开箱中…';

    const reel = document.createElement('div');
    reel.className = 'pen-case-reel';
    const marker = document.createElement('div');
    marker.className = 'pen-case-marker';
    marker.setAttribute('aria-hidden', 'true');
    const status = document.createElement('div');
    status.className = 'pen-case-status';
    status.textContent = '正在解析奖池…';

    const pool = PEN_SKINS.filter((skin) => skin.rarity !== 'free');
    const targetIndex = 23;
    const reelLength = 31;
    for (let index = 0; index < reelLength; index += 1) {
      const skin = index === targetIndex ? result.skin : randomPick(pool);
      reel.appendChild(createCaseReelCard(skin, index === targetIndex));
    }
    stage.replaceChildren(reel, marker, status);
    stage.classList.add('is-active');
    playGachaSfx('unlock', { rarity: result.skin.rarity, volume: 0.5 });

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      reel.classList.add('is-stopped');
      status.textContent = result.duplicate
        ? `重复皮肤 · 转化为 ${result.fragmentsGained} 笔芯碎片`
        : `获得 ${result.skin.name} · ${PEN_RARITY_META[result.skin.rarity].label}`;
      playGachaSfx(result.skin.rarity, { rarity: result.skin.rarity, volume: 0.58 });
      if (result.skin.rarity === 'legendary') announceLegendaryDraw(result.skin);
      penGachaOpening = false;
      if (wrap && wrap.isConnected && $('#overlayContent').contains(wrap) && !$('#overlay').classList.contains('hidden')) {
        window.setTimeout(() => {
          if (wrap.isConnected && $('#overlayContent').contains(wrap) && !$('#overlay').classList.contains('hidden')) {
            showPenSkinModal([result]);
          }
        }, 420);
      }
    };

    const animate = () => {
      const card = reel.children[targetIndex];
      const cardWidth = card ? card.getBoundingClientRect().width : 88;
      const gap = 8;
      const center = stage.getBoundingClientRect().width / 2;
      const targetCenter = targetIndex * (cardWidth + gap) + cardWidth / 2;
      const finalOffset = center - targetCenter;
      // 先把物品带明确放在起点，并强制浏览器完成布局；否则浏览器可能把起点和终点合并，
      // 看起来就像没有移动动画。
      reel.style.transform = 'translate3d(0, 0, 0)';
      void reel.offsetWidth;
      playGachaSfx('open', { rarity: result.skin.rarity, volume: 0.46 });
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const animationMs = prefersReducedMotion ? 1150 : 3600;
      window.requestAnimationFrame(() => {
        reel.style.transition = prefersReducedMotion
          ? 'transform 1.15s cubic-bezier(.18,.05,.16,1)'
          : 'transform 3.6s cubic-bezier(.16,.04,.14,1)';
        reel.style.transform = `translate3d(${finalOffset}px, 0, 0)`;
        const tickTimer = prefersReducedMotion
          ? null
          : window.setInterval(() => {
            if (revealed) {
              window.clearInterval(tickTimer);
              return;
            }
            playGachaSfx('scroll', { rarity: result.skin.rarity, volume: 0.2 });
          }, 92);
        window.setTimeout(() => {
          if (tickTimer) window.clearInterval(tickTimer);
          reveal();
        }, animationMs + 170);
      });
    };

    window.requestAnimationFrame(animate);
  }

  function showPenSkinModal(lastResults = []) {
    const wrap = document.createElement('div');
    wrap.className = 'pen-skin-dialog';

    const header = document.createElement('div');
    header.className = 'pen-skin-header';
    const titleBox = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = '🖊️ 笔皮肤工坊';
    const subtitle = document.createElement('p');
    subtitle.textContent = '免费收集本地笔皮肤，只有笔尖外观会变化';
    titleBox.append(title, subtitle);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'overlay-close';
    close.textContent = '×';
    close.title = '关闭';
    close.addEventListener('click', hideOverlay);
    header.append(titleBox, close);
    wrap.appendChild(header);

    const current = selectedPenSkin();
    const preview = document.createElement('div');
    preview.className = `pen-skin-preview rarity-${PEN_RARITY_META[current.rarity].className}`;
    const previewImage = createPenSkinImage(current, 'pen-skin-preview-image');
    const previewText = document.createElement('div');
    previewText.className = 'pen-skin-preview-text';
    const previewName = document.createElement('strong');
    previewName.textContent = current.name;
    const previewDesc = document.createElement('span');
    previewDesc.textContent = current.description;
    previewText.append(previewName, previewDesc);
    preview.append(previewImage, previewText);
    wrap.appendChild(preview);

    const currency = document.createElement('div');
    currency.className = 'pen-skin-currency';
    const dust = document.createElement('span');
    dust.dataset.penCurrency = 'stardust';
    dust.textContent = `✨ 涂鸦星尘 ${penCollection.stardust}`;
    const fragments = document.createElement('span');
    fragments.dataset.penCurrency = 'fragments';
    fragments.textContent = `🧩 笔芯碎片 ${penCollection.fragments}`;
    const bonusDraws = document.createElement('span');
    bonusDraws.dataset.penCurrency = 'bonus-draws';
    bonusDraws.textContent = `🎁 赠送抽数 ${penCollection.bonusDraws}`;
    currency.append(dust, fragments, bonusDraws);
    wrap.appendChild(currency);

    const inActiveRoom = Boolean(
      PEN_LOCAL_TEST_MODE
      && state.roomCode
      && state.connected
      && state.phase !== 'waiting'
      && state.phase !== 'finished',
    );
    if (inActiveRoom) {
      const adminBox = document.createElement('section');
      adminBox.className = 'pen-gacha-admin-box';
      const adminTitle = document.createElement('h3');
      adminTitle.textContent = '🛠 本局测试发放';
      const adminTip = document.createElement('p');
      adminTip.textContent = '发给当前在线玩家（包括自己），仅 localhost 可用。';
      const adminButtons = document.createElement('div');
      adminButtons.className = 'pen-gacha-admin-buttons';
      [1, 3, 10].forEach((amount) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.textContent = `全员 +${amount} 抽`;
        button.addEventListener('click', () => {
          button.disabled = true;
          send({ type: 'pen_gacha_grant', amount });
          window.setTimeout(() => { button.disabled = false; }, 760);
        });
        adminButtons.appendChild(button);
      });
      adminBox.append(adminTitle, adminTip, adminButtons);
      wrap.appendChild(adminBox);
    }

    const drawBox = document.createElement('div');
    drawBox.className = 'pen-gacha-box';
    const drawTitle = document.createElement('h3');
    drawTitle.textContent = PEN_LOCAL_TEST_MODE ? '单抽开箱 · 本机测试' : '单抽开箱';
    const drawTip = document.createElement('p');
    drawTip.textContent = PEN_LOCAL_TEST_MODE
      ? '当前为本机测试账号：每次只开一箱，不消耗星尘，仅此 localhost 浏览器生效。'
      : '每次只开一箱，赠送抽数优先消耗；没有赠送抽数时消耗 1 点星尘。';
    const drawButtons = document.createElement('div');
    drawButtons.className = 'pen-gacha-buttons';
    const drawOnce = document.createElement('button');
    drawOnce.type = 'button';
    drawOnce.className = 'btn primary';
    drawOnce.dataset.penGachaDrawButton = '1';
    drawOnce.textContent = penDrawButtonText();
    drawOnce.disabled = !PEN_LOCAL_TEST_MODE
      && penCollection.stardust + penCollection.bonusDraws < 1;
    const caseStage = document.createElement('div');
    caseStage.className = 'pen-case-stage';
    caseStage.setAttribute('aria-live', 'polite');
    drawOnce.addEventListener('click', () => {
      const results = drawPenSkins(1);
      if (results.length) startPenCaseOpening(caseStage, drawOnce, results[0], wrap);
    });
    drawButtons.append(drawOnce);
    const pity = document.createElement('div');
    pity.className = 'pen-gacha-pity';
    pity.textContent = `保底进度：稀有 ${penCollection.pityRare}/10 · 史诗 ${penCollection.pityEpic}/30 · 传说 ${penCollection.pityLegendary}/60 · 第 60 抽优先给未拥有皮肤`;
    const audioTip = document.createElement('div');
    audioTip.className = 'pen-gacha-audio-tip';
    audioTip.textContent = '🔊 本地测试优先读取开发音效槽位；缺失时自动使用轻量提示音。';
    drawBox.append(drawTitle, drawTip, drawButtons, caseStage, pity, audioTip);
    wrap.appendChild(drawBox);

    if (lastResults.length) {
      const resultsBox = document.createElement('div');
      resultsBox.className = 'pen-draw-results';
      const resultsTitle = document.createElement('h3');
      resultsTitle.textContent = `本次结果 · ${lastResults.length} 抽`;
      const resultsGrid = document.createElement('div');
      resultsGrid.className = 'pen-draw-results-grid';
      lastResults.forEach((result) => {
        const resultCard = document.createElement('div');
        resultCard.className = `pen-draw-result rarity-${PEN_RARITY_META[result.skin.rarity].className}`;
        resultCard.appendChild(createPenSkinImage(result.skin, 'pen-draw-result-image'));
        const resultName = document.createElement('strong');
        resultName.textContent = result.skin.name;
        const resultStatus = document.createElement('span');
        resultStatus.textContent = result.duplicate ? `重复 · +${result.fragmentsGained} 碎片` : '新皮肤已加入';
        resultCard.append(resultName, resultStatus);
        resultsGrid.appendChild(resultCard);
      });
      resultsBox.append(resultsTitle, resultsGrid);
      wrap.appendChild(resultsBox);
    }

    const collectionTitle = document.createElement('h3');
    collectionTitle.className = 'pen-collection-title';
    collectionTitle.textContent = `我的收藏 · ${penCollection.owned.length}/${PEN_SKINS.length}`;
    wrap.appendChild(collectionTitle);
    const grid = document.createElement('div');
    grid.className = 'pen-skin-grid';
    PEN_SKINS.forEach((skin) => grid.appendChild(createPenSkinCard(skin, lastResults)));
    wrap.appendChild(grid);

    const footnote = document.createElement('p');
    footnote.className = 'pen-skin-footnote';
    footnote.textContent = '提示：作画时自己和其他玩家的画板都会显示这支笔，停笔后立即隐藏。派蒙、电光奇缘、初音·未来回响、重音Teto、深蓝月蚀、方块秘境、龙焰、波奇、空我、初号机和蜜雪主题笔的特效都只在本地根据已有起笔/收笔事件生成，不增加网络事件。';
    wrap.appendChild(footnote);
    showOverlay(wrap);
  }

  function formatElapsed(ms) {
    return `${(ms / 1000).toFixed(1)} 秒`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[ch]);
  }

  // 缩略图只通过 src 属性赋值：把整串 base64 拼进 innerHTML 等于绕过了所有转义约定
  function thumbnailNode(value) {
    const image = String(value || '');
    if (/^data:image\/(jpeg|png|webp);base64,/i.test(image)) {
      const img = document.createElement('img');
      img.alt = '画作';
      img.src = image;
      return img;
    }
    const empty = document.createElement('div');
    empty.className = 'gallery-noimg';
    empty.textContent = '无缩略图';
    return empty;
  }

  function cloneReplayStrokes() {
    return board.strokes.flatMap((s) => {
      if (s.kind === 'fill') {
        return [{ kind: 'fill', x: s.x, y: s.y, color: s.color }];
      }
      if (s.kind) return [];
      return [{
        id: s.id,
        color: s.color,
        size: s.size,
        tool: s.tool || 'pen',
        points: s.points.map((pt) => [pt[0], pt[1]]),
      }];
    });
  }

  function drawReplayFrame(ctx, strokes, pointBudget, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    let budget = pointBudget;
    for (const stroke of strokes) {
      if (stroke.kind === 'fill') {
        if (budget >= 1) {
          floodFillCanvas(ctx, stroke.x, stroke.y, stroke.color);
          budget -= 1;
        }
        continue;
      }
      const pts = stroke.points;
      if (pts.length === 0) continue;
      const visible = Math.max(0, Math.min(pts.length, budget));
      if (visible <= 0) continue;
      budget -= visible;
      const sizePx = Math.max(1.5, stroke.size * W);
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.tool === 'highlighter' ? sizePx * 2.4 : sizePx;
      ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.4 : 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const px = pts.slice(0, visible);
      const [x0, y0] = [px[0][0] * W, px[0][1] * H];
      if (isShapeTool(stroke.tool)) {
        const end = px[px.length - 1] || px[0];
        drawShapeOutline(ctx, stroke.tool, px[0], end, W, H);
        ctx.restore();
        continue;
      }
      if (px.length === 1) {
        ctx.beginPath();
        ctx.arc(x0, y0, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let i = 1; i < px.length; i += 1) ctx.lineTo(px[i][0] * W, px[i][1] * H);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function playArtworkReplay(canvas, strokes, duration = 3500) {
    if (!canvas || !strokes || strokes.length === 0) return;
    const token = (state.replayToken || 0) + 1;
    state.replayToken = token;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const totalPoints = strokes.reduce((n, s) => n + (s.kind === 'fill' ? 1 : Math.max(1, s.points.length)), 0);
    const startedAt = performance.now();
    if (state.currentArtwork) state.currentArtwork.replaying = true;

    const frame = () => {
      if (token !== state.replayToken) return;
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(1, elapsed / duration);
      const budget = Math.ceil(totalPoints * ratio);
      drawReplayFrame(ctx, strokes, budget, W, H);
      if (ratio < 1) {
        requestAnimationFrame(frame);
      } else {
        if (state.currentArtwork) state.currentArtwork.replaying = false;
        updateArtworkModal();
      }
    };
    requestAnimationFrame(frame);
  }

  function makeCorrectTimesList(times) {
    const box = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = '⚡ 猜中时间排行';
    box.appendChild(title);
    if (!times || times.length === 0) {
      const empty = document.createElement('p');
      empty.style.color = '#64748b';
      empty.style.fontSize = '13px';
      empty.textContent = '本轮没有人猜中';
      box.appendChild(empty);
      return box;
    }
    const list = document.createElement('div');
    list.className = 'rank-list';
    times.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'rank-item';
      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = ['🥇', '🥈', '🥉'][i] || String(i + 1);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.nickname;
      const time = document.createElement('span');
      time.className = 'score';
      time.textContent = formatElapsed(item.elapsedMs);
      row.append(pos, name, time);
      list.appendChild(row);
    });
    box.appendChild(list);
    return box;
  }

  function makeRankList(scores) {
    const list = document.createElement('div');
    list.className = 'rank-list';
    scores.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'rank-item';
      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = ['🥇', '🥈', '🥉'][i] || String(i + 1);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.nickname;
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = `${p.score} 分`;
      row.append(pos, name, score);
      list.appendChild(row);
    });
    return list;
  }

  // ---------- 音乐点歌 ----------
  function formatSongDuration(seconds) {
    const s = Math.round(Number(seconds) || 0);
    if (!s) return '';
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function activateTab(name) {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    $('#chatList').classList.toggle('hidden', name !== 'chat');
    $('#playerListGame').classList.toggle('hidden', name !== 'players');
    $('#musicPanel').classList.toggle('hidden', name !== 'music');
    $('#chatForm').classList.toggle('hidden', name !== 'chat');
  }

  function musicTracks() {
    const tracks = [];
    const seen = new Set();
    const add = (song) => {
      if (!song || !song.key || seen.has(song.key)) return;
      seen.add(song.key);
      tracks.push(song);
    };
    add(state.musicRoomCurrent);
    for (const song of state.musicQueue || []) add(song);
    return tracks;
  }

  function musicStatusText(status) {
    const texts = {
      idle: '本机未播放',
      loading: '正在加载本机音频…',
      playing: '本机正在播放 · 各设备独立控制',
      blocked: '浏览器阻止了自动播放，请点击启用音乐',
      stopped: '本机已停止',
      ended: '本机队列已播放完毕',
      error: '本机播放失败，请重试',
    };
    return texts[status] || texts.idle;
  }

  function updateMusicPlaybackUI() {
    const current = state.musicCurrent;
    const roomCurrent = state.musicRoomCurrent;
    const nowEl = $('#nowPlaying');
    if (nowEl) {
      nowEl.textContent = current
        ? `${current.title}${current.trial ? '（试听）' : ''}${current.uploader ? ` - ${current.uploader}` : ''}`
        : '本机未播放';
    }
    const roomEl = $('#musicRoomNow');
    if (roomEl) {
      roomEl.textContent = roomCurrent
        ? `房间队列起点：${roomCurrent.title || '未知歌曲'}`
        : '房间暂未开始播放';
    }
    const statusEl = $('#musicPlaybackStatus');
    if (statusEl) {
      statusEl.textContent = musicStatusText(state.musicPlaybackStatus);
      statusEl.dataset.state = state.musicPlaybackStatus;
    }
    const enableBtn = $('#musicEnableBtn');
    if (enableBtn) {
      const needsGesture = state.musicPlaybackStatus === 'blocked' && Boolean(state.musicPendingSong);
      enableBtn.classList.toggle('hidden', !needsGesture);
      enableBtn.textContent = state.musicAudioUnlocked ? '▶ 继续播放' : '🔊 点击启用音乐';
    }
    const controls = $('#musicLocalOps');
    if (controls) controls.classList.toggle('hidden', musicTracks().length === 0);
    const skipBtn = $('#musicSkipBtn');
    if (skipBtn) {
      const currentIndex = musicTracks().findIndex((song) => song.key === current?.key);
      skipBtn.disabled = currentIndex < 0 || currentIndex >= musicTracks().length - 1;
    }
    const stopBtn = $('#musicStopBtn');
    if (stopBtn) stopBtn.textContent = current ? '⏹ 本机停止' : '▶ 本机播放';
  }

  function setMusicPlaybackStatus(status) {
    state.musicPlaybackStatus = status;
    updateMusicPlaybackUI();
  }

  function nextLocalMusic() {
    const tracks = musicTracks();
    const currentKey = state.musicCurrent && state.musicCurrent.key;
    const index = tracks.findIndex((song) => song.key === currentKey);
    if (index < 0) return tracks[0] || null;
    return tracks[index + 1] || null;
  }

  function resumeLocalMusic() {
    const song = state.musicPendingSong || state.musicCurrent || state.musicRoomCurrent || state.musicQueue[0];
    if (song) playMusic(song, { force: true });
  }

  function playMusic(song, { force = false } = {}) {
    if (!song || !song.url) {
      setMusicPlaybackStatus('error');
      return false;
    }
    if (!force && musicPlayingKey === song.key && !musicAudio.paused) return true;

    musicAudio.pause();
    musicAudio.preload = 'auto';
    musicPlayingKey = song.key;
    state.musicCurrent = song;
    state.musicPendingSong = song;
    setMusicLyric(song.lyric || '');
    setMusicPlaybackStatus('loading');
    renderMusicPanel();

    const url = new URL(song.url, location.href).href;
    if (musicAudio.src !== url) {
      musicAudio.src = url;
      musicAudio.load();
    }
    try {
      musicAudio.currentTime = 0;
    } catch {
      // 等待音频元数据加载后从开头播放
    }

    const requestedKey = song.key;
    const playPromise = musicAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        if (musicPlayingKey !== requestedKey) return;
        state.musicAudioUnlocked = true;
        state.musicPendingSong = null;
        setMusicPlaybackStatus('playing');
      }).catch((err) => {
        if (musicPlayingKey !== requestedKey) return;
        console.warn('音乐播放失败', err);
        setMusicPlaybackStatus('blocked');
      });
    } else {
      state.musicAudioUnlocked = true;
      state.musicPendingSong = null;
      setMusicPlaybackStatus('playing');
    }
    return true;
  }

  function playNextLocalMusic() {
    const finished = state.musicCurrent;
    if (finished && finished.key) {
      send({ type: 'music_finished', key: finished.key, playId: finished.playId || 0 });
    }
    const next = nextLocalMusic();
    if (next && next.key !== (finished && finished.key)) {
      playMusic(next, { force: true });
    } else {
      state.musicRoomCurrent = null;
      stopMusic('ended');
    }
  }

  function stopMusic(status = 'stopped') {
    musicPlayingKey = null;
    state.musicPendingSong = null;
    musicAudio.pause();
    musicAudio.removeAttribute('src');
    state.musicCurrent = null;
    state.musicLyric = '';
    state.lyricLines = [];
    state.musicPlaybackStatus = status;
    updateLyricUI();
    renderMusicPanel();
  }

  musicAudio.addEventListener('ended', playNextLocalMusic);

  // ---------- 歌词显示 ----------
  function parseLrc(lrc) {
    const lines = [];
    if (!lrc) return lines;
    const timeRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
    const rawLines = String(lrc).split(/\r?\n/);
    for (const raw of rawLines) {
      const times = [];
      const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
      let m;
      while ((m = re.exec(raw))) {
        const min = Number(m[1]);
        const sec = Number(m[2]);
        const fracStr = m[3] || '0';
        const frac = fracStr.length === 1
          ? Number(fracStr) * 100
          : fracStr.length === 2
            ? Number(fracStr) * 10
            : Number(fracStr);
        times.push(min * 60 + sec + frac / 1000);
      }
      const text = raw.replace(timeRe, '').trim();
      if (!text) continue;
      for (const t of times) lines.push({ time: t, text });
    }
    lines.sort((a, b) => a.time - b.time);
    return lines;
  }

  function setMusicLyric(lrc) {
    state.musicLyric = lrc || '';
    state.lyricLines = parseLrc(state.musicLyric);
    updateLyricUI();
  }

  function updateLyricUI() {
    const box = $('#musicLyrics');
    if (box) {
      if (!state.lyricLines || state.lyricLines.length === 0) {
        box.innerHTML = '<div class="music-lyrics-line muted">暂无歌词</div>';
      } else {
        const t = musicAudio.currentTime || 0;
        let idx = 0;
        for (let i = 0; i < state.lyricLines.length; i += 1) {
          if (state.lyricLines[i].time <= t + 0.3) idx = i;
          else break;
        }
        const start = Math.max(0, idx - 1);
        const slice = state.lyricLines.slice(start, start + 3);
        box.innerHTML = slice.map((l, i) => (
          `<div class="music-lyrics-line${i === 1 ? ' active' : ''}">${escapeHtml(l.text)}</div>`
        )).join('') || '<div class="music-lyrics-line muted">暂无歌词</div>';
      }
    }
    updateFloatLyrics();
  }

  function updateFloatLyrics() {
    const el = $('#floatLyrics');
    const text = $('#floatLyricsText');
    if (!el || !text) return;
    if (!state.lyricsFloatOn) {
      el.classList.add('hidden');
      return;
    }
    if (!state.lyricLines || state.lyricLines.length === 0) {
      el.classList.remove('hidden');
      el.classList.add('muted');
      text.innerHTML = '暂无歌词';
      return;
    }
    const t = musicAudio.currentTime || 0;
    let idx = 0;
    for (let i = 0; i < state.lyricLines.length; i += 1) {
      if (state.lyricLines[i].time <= t + 0.3) idx = i;
      else break;
    }
    const current = state.lyricLines[idx];
    const next = state.lyricLines[idx + 1];
    el.classList.remove('hidden', 'muted');
    text.innerHTML = `${escapeHtml(current ? current.text : '')}${next ? `<span class="lyric-sub">${escapeHtml(next.text)}</span>` : ''}`;
  }

  function renderMusicPanel() {
    const current = state.musicCurrent;

    const list = $('#musicQueueList');
    if (list) {
      list.innerHTML = '';
      if (!state.musicQueue || state.musicQueue.length === 0) {
        const li = document.createElement('li');
        li.className = 'music-queue-empty';
        li.textContent = '队列是空的，搜索 GD 音乐台或输入 BV 号点歌吧';
        list.appendChild(li);
      } else {
        state.musicQueue.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'music-queue-item';
          const status = item.status === 'downloading' ? '（下载中…）' : '';
          const trial = item.trial ? '（试听）' : '';
          const local = current && current.key === item.key ? ' · 本机播放中' : '';
          li.textContent = `${item.title}${trial}${status}${local} · ${item.requestedBy || ''}`;
          list.appendChild(li);
        });
      }
    }

    updateMusicPlaybackUI();
  }

  function renderGdResults() {
    const box = $('#gdResults');
    if (!box) return;
    box.innerHTML = '';
    const results = state.gdResults || [];
    if (results.length === 0) return;

    for (const song of results) {
      const item = document.createElement('div');
      item.className = 'gd-result-item';
      const title = document.createElement('div');
      title.className = 'gd-result-title';
      title.textContent = song.title || '未知歌曲';
      const meta = document.createElement('div');
      meta.className = 'gd-result-meta';
      const parts = [];
      if (song.artist) parts.push(song.artist);
      if (song.album) parts.push(song.album);
      if (song.duration) parts.push(formatSongDuration(song.duration));
      meta.textContent = parts.join(' · ');

      const actions = document.createElement('div');
      actions.className = 'gd-result-actions';
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.textContent = '🎵 点歌';
      btn.addEventListener('click', () => {
        send({
          type: 'music_gd_request',
          songId: song.id,
          urlId: song.urlId,
          lyricId: song.lyricId,
          title: song.title,
          artist: song.artist,
          duration: song.duration,
          cover: song.cover,
        });
        btn.disabled = true;
        btn.textContent = '已提交';
      });
      actions.appendChild(btn);
      item.append(title, meta, actions);
      box.appendChild(item);
    }
  }

  function renderBiliPreview() {
    const box = $('#biliPreview');
    if (!box) return;
    box.innerHTML = '';
    const r = state.biliResolved;
    if (!r) return;
    const info = r.info || {};
    const div = document.createElement('div');
    div.className = 'bili-preview';

    const title = document.createElement('div');
    title.className = 'bili-preview-title';
    title.textContent = info.title || r.bvid;

    const meta = document.createElement('div');
    meta.className = 'bili-preview-meta';
    const sourceNames = {
      'yt-dlp': 'yt-dlp',
      'bilibili-api': 'B站官方接口',
    };
    const sourceLabel = sourceNames[info.resolvedBy] || '';
    meta.textContent = [
      info.uploader || '未知UP主',
      formatSongDuration(info.duration),
      sourceLabel ? `解析源：${sourceLabel}` : '',
    ].filter(Boolean).join(' · ');

    div.appendChild(title);
    div.appendChild(meta);

    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = '🎵 点这首歌';
    btn.addEventListener('click', () => {
      send({ type: 'music_bili_request', bvid: r.bvid });
      btn.disabled = true;
      btn.textContent = '已提交';
    });
    div.appendChild(btn);
    box.appendChild(div);
  }

  function startFlowerBurst() {
    const layer = $('#burstLayer');
    if (!layer) return;
    const emojis = ['🌸', '💐', '🌷', '🌹', '✨'];
    const count = window.innerWidth < 600 ? 18 : 32;
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement('span');
      el.className = 'burst-item';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.setProperty('--dx', `${Math.round((Math.random() * 2 - 1) * Math.min(window.innerWidth * 0.4, 320))}px`);
      el.style.setProperty('--dy', `${Math.round((Math.random() * 2 - 1) * Math.min(window.innerHeight * 0.4, 320))}px`);
      el.style.setProperty('--rot', `${Math.round((Math.random() * 2 - 1) * 360)}deg`);
      el.style.animationDuration = `${1.4 + Math.random() * 0.7}s`;
      el.style.animationDelay = `${Math.random() * 0.12}s`;
      layer.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  function generateArtworkThumbnail() {
    const source = $('#board');
    const size = 240;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(source, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  function uploadArtworkIfNeeded(data) {
    if (!data.artworkId || !data.uploaderId || data.uploaderId !== state.playerId) return;
    if (data.thumbnail) return;
    setTimeout(() => {
      try {
        const image = generateArtworkThumbnail();
        send({ type: 'upload_artwork', artworkId: data.artworkId, image });
      } catch {
        // 个别浏览器不允许导出 canvas，忽略
      }
    }, 250);
  }

  function updateArtworkModal() {
    const overlay = $('#overlayContent');
    const art = state.currentArtwork;
    if (!art) return;

    const img = overlay.querySelector('.art-thumb');
    const placeholder = overlay.querySelector('.art-thumb-placeholder');
    const replayCanvas = overlay.querySelector('.art-replay-canvas');
    const download = overlay.querySelector('.art-download-btn');
    if (img && art.thumbnail && img.dataset.src !== art.thumbnail) {
      img.dataset.src = art.thumbnail;
      img.src = art.thumbnail;
    }
    if (replayCanvas && art.replaying) {
      replayCanvas.classList.remove('hidden');
      if (img) img.classList.add('hidden');
      if (placeholder) placeholder.classList.add('hidden');
    } else if (img && art.thumbnail) {
      img.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
      if (replayCanvas) replayCanvas.classList.add('hidden');
    }
    if (download && art.thumbnail) {
      download.classList.remove('disabled');
      download.href = art.thumbnail;
      download.setAttribute('download', `你画我猜-第${art.round || 0}轮-第${art.turnInRound || 0}位画手.jpg`);
      download.textContent = '⬇ 下载这幅画';
    }

    const vegBtn = overlay.querySelector('.rate-veg');
    const flowerBtn = overlay.querySelector('.rate-flower');
    if (vegBtn) {
      const count = vegBtn.querySelector('.count');
      if (count) count.textContent = String(art.vegCount || 0);
      vegBtn.classList.toggle('my-veg', art.myKind === 'veg');
    }
    if (flowerBtn) {
      const count = flowerBtn.querySelector('.count');
      if (count) count.textContent = String(art.flowerCount || 0);
      flowerBtn.classList.toggle('my-flower', art.myKind === 'flower');
    }
  }

  function showRoundResult(data) {
    state.currentArtwork = {
      id: data.artworkId || null,
      round: data.round,
      turnInRound: data.turnInRound,
      perfect: Boolean(data.perfect),
      uploaderId: data.uploaderId || null,
      thumbnail: data.thumbnail || null,
      myKind: data.myKind || null,
      vegCount: data.vegCount || 0,
      flowerCount: data.flowerCount || 0,
    };
    state.resultEndsAt = serverNow() + (data.resultDuration || 8000);
    state.skipVotes = Number(data.skipVotes) || 0;
    state.skipRequired = Number(data.skipRequired) || 0;
    state.skipVoted = Boolean(data.skipVoted);
    renderMusicPanel();
    if (data.perfect) startFlowerBurst();
    uploadArtworkIfNeeded(data);

    const wrap = document.createElement('div');
    const h = document.createElement('h2');
    h.textContent = data.perfect ? '🌸 全部猜中！🌸' : (data.playersPerRound
      ? `第 ${data.round}/${data.totalRounds} 轮 · 第 ${data.turnInRound}/${data.playersPerRound} 位画手结束`
      : `第 ${data.round}/${data.totalRounds} 轮结束`);
    const answer = document.createElement('div');
    answer.className = 'answer';
    answer.textContent = `${data.word}（${data.category}）`;
    const note = document.createElement('p');
    const reasonMap = {
      all_guessed: '所有人都猜中了！',
      timeout: '时间到',
      drawer_offline: '画手掉线超时',
      drawer_left: '画手离开了房间',
      drawer_kicked: '画手被移出房间',
    };
    note.textContent = `${reasonMap[data.reason] || '本轮结束'} · 猜中：${data.correctGuesserNames.length > 0 ? data.correctGuesserNames.join('、') : '无'}`;

    const artBox = document.createElement('div');
    artBox.className = 'artwork-box';
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'art-thumb-wrap';
    const placeholder = document.createElement('span');
    placeholder.className = 'art-thumb-placeholder';
    placeholder.textContent = '缩略图生成中…';
    const img = document.createElement('img');
    img.className = 'art-thumb hidden';
    img.alt = '本回合画作';
    const replayCanvas = document.createElement('canvas');
    replayCanvas.className = 'art-replay-canvas';
    replayCanvas.width = 240;
    replayCanvas.height = 240;
    thumbWrap.append(placeholder, img, replayCanvas);

    const actions = document.createElement('div');
    actions.className = 'art-actions';
    const vegBtn = document.createElement('button');
    vegBtn.className = 'art-rate-btn rate-veg';
    vegBtn.innerHTML = '🥦 丢蔬菜 <span class="count">0</span>';
    const flowerBtn = document.createElement('button');
    flowerBtn.className = 'art-rate-btn rate-flower';
    flowerBtn.innerHTML = '🌸 送鲜花 <span class="count">0</span>';
    actions.append(vegBtn, flowerBtn);

    vegBtn.addEventListener('click', () => {
      if (!state.currentArtwork || !state.currentArtwork.id) return;
      send({ type: 'rate_artwork', artworkId: state.currentArtwork.id, kind: 'veg' });
      vegBtn.disabled = true;
      setTimeout(() => { vegBtn.disabled = false; }, 1200);
    });
    flowerBtn.addEventListener('click', () => {
      if (!state.currentArtwork || !state.currentArtwork.id) return;
      send({ type: 'rate_artwork', artworkId: state.currentArtwork.id, kind: 'flower' });
      flowerBtn.disabled = true;
      setTimeout(() => { flowerBtn.disabled = false; }, 1200);
    });

    const replayBtn = document.createElement('button');
    replayBtn.className = 'art-replay-btn';
    replayBtn.textContent = '▶ 回放作画';
    replayBtn.addEventListener('click', () => {
      playArtworkReplay(replayCanvas, state.replayStrokes);
    });

    const download = document.createElement('a');
    download.className = 'art-download-btn disabled';
    download.textContent = '缩略图生成中…';
    artBox.append(thumbWrap, replayBtn, actions, download);

    const next = document.createElement('p');
    next.className = 'result-countdown';
    next.textContent = '即将开始下一轮…';

    const skipArea = document.createElement('div');
    skipArea.className = 'skip-vote-area';
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn skip-vote-btn';
    skipBtn.type = 'button';
    skipBtn.addEventListener('click', () => {
      if (state.phase !== 'result') return;
      send({ type: 'skip_vote' });
    });
    const skipStatus = document.createElement('div');
    skipStatus.className = 'skip-vote-status';
    skipArea.append(skipBtn, skipStatus);

    const parts = [h, answer, note, makeCorrectTimesList(data.correctTimes), artBox, makeRankList(data.scores), skipArea, next];
    wrap.append(...parts);
    showOverlay(wrap);
    updateSkipVoteUI();
    state.replayStrokes = cloneReplayStrokes();
    updateArtworkModal();
    setTimeout(() => playArtworkReplay(replayCanvas, state.replayStrokes), 350);
  }

  function updateSkipVoteUI() {
    const button = document.querySelector('.skip-vote-btn');
    const status = document.querySelector('.skip-vote-status');
    if (!button || !status) return;
    const votes = Math.max(0, Number(state.skipVotes) || 0);
    const required = Math.max(0, Number(state.skipRequired) || 0);
    button.textContent = state.skipVoted ? '✅ 已投票（点击取消）' : '⏭ 投票跳过等待';
    button.classList.toggle('voted', state.skipVoted);
    button.disabled = state.phase !== 'result';
    status.textContent = required > 0
      ? `已投票 ${votes}/${required} · 多数票立即开始`
      : '多数票后立即开始下一轮';
  }

  function awardBadgesFor(artworkId, awards) {
    const badges = [];
    if (!awards) return badges;
    if (awards.fastest && awards.fastest.artworkId === artworkId) badges.push('⚡ 最快猜中');
    if (awards.hardest && awards.hardest.artworkId === artworkId) badges.push('🧐 最难看出');
    if (awards.bestFlower && awards.bestFlower.artworkId === artworkId) badges.push('🌸 画得最好');
    if (awards.weirdestVeg && awards.weirdestVeg.artworkId === artworkId) badges.push('🥦 最奇葩');
    return badges;
  }

  function showGameOver(data) {
    const wrap = document.createElement('div');
    const h = document.createElement('h2');
    h.textContent = '🏁 游戏结束 · 本局画廊';
    const winner = data.scores[0];
    const p = document.createElement('p');
    p.textContent = winner ? `冠军：${winner.nickname}` : '无人获胜';
    wrap.append(h, p);
    renderMusicPanel();

    // 四个奖项
    const awards = data.awards || {};
    const awardsBox = document.createElement('div');
    awardsBox.className = 'awards-row';
    const awardItems = [
      { key: 'fastest', icon: '⚡', label: '最快猜中', text: awards.fastest ? `${awards.fastest.nickname} · ${formatElapsed(awards.fastest.elapsedMs)}` : '暂无' },
      { key: 'hardest', icon: '🧐', label: '最难看出', text: awards.hardest ? `第${awards.hardest.round}-${awards.hardest.turnInRound}幅 · ${formatElapsed(awards.hardest.difficultyMs)}` : '暂无' },
      { key: 'bestFlower', icon: '🌸', label: '画得最好', text: awards.bestFlower ? `${awards.bestFlower.flowerCount} 朵鲜花` : '暂无' },
      { key: 'weirdestVeg', icon: '🥦', label: '最奇葩', text: awards.weirdestVeg ? `${awards.weirdestVeg.vegCount} 个蔬菜` : '暂无' },
    ];
    for (const item of awardItems) {
      const card = document.createElement('div');
      card.className = 'award-card';
      const icon = document.createElement('div');
      icon.className = 'award-icon';
      icon.textContent = item.icon;
      const label = document.createElement('div');
      label.className = 'award-label';
      label.textContent = item.label;
      const text = document.createElement('div');
      text.className = 'award-text';
      text.textContent = item.text;
      card.append(icon, label, text);
      awardsBox.appendChild(card);
    }
    wrap.appendChild(awardsBox);

    // 画廊人气排名：鲜花多者靠前
    const gallery = [...(data.gallery || [])].sort((a, b) => b.flowerCount - a.flowerCount || b.vegCount - a.vegCount);
    const galleryTitle = document.createElement('h3');
    galleryTitle.textContent = `🖼 本局画廊排名（${gallery.length}）`;
    wrap.appendChild(galleryTitle);

    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    gallery.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      const rank = document.createElement('div');
      rank.className = 'gallery-rank';
      rank.textContent = `#${index + 1}`;
      const badges = awardBadgesFor(item.id, awards);
      const badgeText = badges.length ? `<div class="gallery-badges">${badges.join(' ')}</div>` : '';
      card.innerHTML = `
        ${rank.outerHTML}
        <div class="gallery-thumb"></div>
        <div class="gallery-meta">
          <div class="gallery-title">第${item.round}轮 · ${escapeHtml(item.word)}</div>
          <div class="gallery-sub">🎨 ${escapeHtml(item.drawerNickname)}</div>
          ${badgeText}
          <div class="gallery-stats">🌸 ${item.flowerCount} · 🥦 ${item.vegCount}</div>
          <div class="gallery-fast">${item.fastestGuessMs != null ? `⚡ 最快 ${formatElapsed(item.fastestGuessMs)}` : '无人猜中'}</div>
        </div>`;
      card.querySelector('.gallery-thumb').appendChild(thumbnailNode(item.thumbnail));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    wrap.appendChild(makeRankList(data.scores));

    if (state.you && state.you.isHost) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn big';
      backBtn.textContent = '🏠 返回房间';
      backBtn.addEventListener('click', () => {
        send({ type: 'back_to_room' });
      });
      wrap.appendChild(backBtn);

      const btn = document.createElement('button');
      btn.className = 'btn primary big';
      btn.textContent = '再来一局';
      btn.addEventListener('click', () => {
        send({ type: 'play_again' });
      });
      wrap.appendChild(btn);
    } else {
      const tip = document.createElement('p');
      tip.style.color = '#64748b';
      tip.style.fontSize = '13px';
      tip.textContent = '等待房主返回房间或开始下一局…';
      wrap.appendChild(tip);
    }
    showOverlay(wrap);
  }

  function handleRelayTask(msg) {
    state.relayTask = msg;
    state.relayRevealBooks = null;
    state.relayBookIndex = msg.bookIndex;
    showScreen('game');
    board.reset();
    if (msg.events && msg.events.length) board.replay(msg.events);
    if (msg.kind === 'draw') {
      state.relayDidDraw = true;
      if (msg.promptType === 'word') {
        toast(`你的秘密词：${msg.promptWord}`, 'ok');
      } else {
        toast(`请画出：${msg.promptGuess}`, 'ok');
      }
    } else {
      state.relayDidDraw = false;
      toast('看图猜词，提交你的答案', 'ok');
    }
    updateGameUI();
  }

  function maybeUploadRelayArtwork() {
    if (!state.relayDidDraw || state.phase !== 'relay_collect' || state.relayBookIndex == null) return;
    try {
      const image = generateArtworkThumbnail();
      send({ type: 'relay_upload', bookIndex: state.relayBookIndex, image });
    } catch {
      // 忽略导出失败
    }
  }

  function showRelayReveal(msg) {
    state.relayRevealBooks = (msg.books || []).map((book) => ({
      ...book,
      vegCount: book.vegCount || 0,
      flowerCount: book.flowerCount || 0,
    }));
    renderRelayReveal();
  }

  function renderRelayReveal() {
    const books = state.relayRevealBooks || [];
    const wrap = document.createElement('div');
    const h = document.createElement('h2');
    h.textContent = '📞 传画接龙揭晓';
    const tip = document.createElement('p');
    tip.style.color = '#64748b';
    tip.style.fontSize = '13px';
    tip.textContent = '给最离谱的链送蔬菜，给最喜欢的链送鲜花';
    wrap.append(h, tip);

    const list = document.createElement('div');
    list.className = 'relay-books';
    books.forEach((book) => {
      const card = document.createElement('div');
      card.className = 'relay-book';
      const title = document.createElement('div');
      title.className = 'relay-book-title';
      title.textContent = `链条 ${book.id + 1} · 原始词：${book.originalWord}`;
      card.appendChild(title);

      book.entries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'relay-entry';
        if (entry.type === 'draw') {
          const who = document.createElement('div');
          who.className = 'relay-who';
          who.textContent = `🎨 ${entry.playerName}`;
          const imgWrap = document.createElement('div');
          imgWrap.className = 'relay-thumb';
          if (entry.thumbnail) {
            const img = document.createElement('img');
            img.src = entry.thumbnail;
            img.alt = '画作';
            imgWrap.appendChild(img);
          } else {
            imgWrap.textContent = '这幅画丢了 😢';
          }
          row.append(who, imgWrap);
        } else {
          const who = document.createElement('div');
          who.className = 'relay-who';
          who.textContent = `💬 ${entry.playerName}`;
          const text = document.createElement('div');
          text.className = 'relay-guess';
          text.textContent = entry.text || '没猜出来';
          row.append(who, text);
        }
        card.appendChild(row);
      });

      const actions = document.createElement('div');
      actions.className = 'relay-rate-row';
      const veg = document.createElement('button');
      veg.className = 'art-rate-btn rate-veg';
      veg.innerHTML = `🥦 <span class="count">${book.vegCount}</span>`;
      veg.addEventListener('click', () => send({ type: 'relay_rate', bookIndex: book.id, kind: 'veg' }));
      const flower = document.createElement('button');
      flower.className = 'art-rate-btn rate-flower';
      flower.innerHTML = `🌸 <span class="count">${book.flowerCount}</span>`;
      flower.addEventListener('click', () => send({ type: 'relay_rate', bookIndex: book.id, kind: 'flower' }));
      actions.append(veg, flower);
      card.appendChild(actions);
      list.appendChild(card);
    });
    wrap.appendChild(list);
    showOverlay(wrap);
  }

  function updateRelayRevealRating(msg) {
    if (!state.relayRevealBooks) return;
    const book = state.relayRevealBooks.find((b) => b.id === msg.bookIndex);
    if (!book) return;
    book.vegCount = msg.vegCount;
    book.flowerCount = msg.flowerCount;
    const overlay = $('#overlayContent');
    const card = overlay.querySelectorAll('.relay-book')[msg.bookIndex];
    if (card) {
      const veg = card.querySelector('.rate-veg .count');
      const flower = card.querySelector('.rate-flower .count');
      if (veg) veg.textContent = String(msg.vegCount);
      if (flower) flower.textContent = String(msg.flowerCount);
    }
  }

  function showWordChooser(msg) {
    const wrap = document.createElement('div');
    const h = document.createElement('h2');
    h.textContent = '🎨 请选择题目';
    const tip = document.createElement('p');
    tip.style.color = '#64748b';
    tip.style.fontSize = '13px';
    tip.textContent = '你是本轮画手，选择一个词后立即开始作画';
    wrap.append(h, tip);

    const optionsBox = document.createElement('div');
    optionsBox.style.display = 'flex';
    optionsBox.style.flexDirection = 'column';
    optionsBox.style.gap = '10px';
    optionsBox.style.margin = '12px 0';

    (msg.options || []).forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.padding = '14px';
      btn.style.fontSize = '18px';
      btn.style.fontWeight = '700';
      const difficultyNames = { 1: '简单', 2: '中等', 3: '挑战' };
      const difficulty = difficultyNames[opt.difficulty] || '中等';
      btn.textContent = `${index + 1}. ${opt.word}（${opt.category} · ${difficulty}）`;
      btn.addEventListener('click', () => {
        hideOverlay();
        send({ type: 'choose_word', index });
      });
      optionsBox.appendChild(btn);
    });
    wrap.appendChild(optionsBox);
    showOverlay(wrap);
  }

  // ---------- WebSocket ----------
  function connectWS() {
    if (!state.roomCode || !state.playerId || !state.token) return;
    clearTimeout(state.reconnectTimer);
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    state.ws = ws;
    updateConnState();

    ws.addEventListener('open', () => {
      state.reconnectDelay = 1000;
      send({ type: 'auth', roomCode: state.roomCode, playerId: state.playerId, token: state.token });
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      handleMessage(msg);
    });

    ws.addEventListener('close', (e) => {
      if (state.intentionalClose) return;
      state.connected = false;
      updateConnState();
      if (e.code === 4008) {
        sessionStorage.setItem('dg_duplicate', '1');
        toast('该账号已在另一个窗口打开，本窗口已停止连接', 'error');
        resetToHome();
        return;
      }
      if (e.code === 4001) {
        toast(state.gotFirstState ? '房间已关闭' : '身份已失效，请重新加入', 'error');
        resetToHome({ clearCredentials: true });
        return;
      }
      toast('连接断开，正在重连…', 'error');
      state.reconnectTimer = setTimeout(() => {
        state.reconnectDelay = Math.min(5000, state.reconnectDelay * 1.6);
        connectWS();
      }, state.reconnectDelay);
    });

    ws.addEventListener('error', () => {
      // close 事件会处理
    });
  }

  function resetToHome({ clearCredentials: clearCreds = false } = {}) {
    const leavingCode = state.roomCode;
    state.intentionalClose = true;
    if (state.ws) {
      try { state.ws.close(); } catch { /* ignore */ }
    }
    state.ws = null;
    state.connected = false;
    state.roomCode = null;
    state.playerId = null;
    state.token = null;
    state.players = [];
    state.phase = 'waiting';
    state.privateWord = '';
    state.gotFirstState = false;
    state.serverOffset = null;
    state.currentArtwork = null;
    state.resultEndsAt = null;
    state.skipVotes = 0;
    state.skipRequired = 0;
    state.skipVoted = false;
    state.pendingJoinCode = null;
    state.musicQueue = [];
    state.musicRoomCurrent = null;
    state.musicCurrent = null;
    state.biliResolved = null;
    state.musicSource = 'gd';
    state.gdResults = [];
    state.musicLyric = '';
    state.lyricLines = [];
    state.musicPlaybackStatus = 'idle';
    state.musicPendingSong = null;
    updateLyricUI();
    const gdResultsBox = $('#gdResults');
    if (gdResultsBox) gdResultsBox.innerHTML = '';
    const biliPreviewBox = $('#biliPreview');
    if (biliPreviewBox) biliPreviewBox.innerHTML = '';
    stopMusic('idle');
    $('#roomCodeInput').classList.remove('hidden');
    const createRow = $('#customCodeInput').closest('.join-row');
    if (createRow) createRow.classList.remove('hidden');
    $('#joinBtn').textContent = '加入';
    if (clearCreds && leavingCode) {
      localStorage.removeItem(`dg_player_${leavingCode}`);
      if (localStorage.getItem('dg_last_room') === leavingCode) localStorage.removeItem('dg_last_room');
    }
    if (new URLSearchParams(location.search).has('join')) {
      history.replaceState(null, '', location.pathname);
    }
    board.reset();
    hideOverlay();
    dismissLegendaryAnnouncement({ clearQueue: true });
    showScreen('home');
    updateConnState();
  }

  function handleMessage(msg) {
    observeServerTime(msg.serverTime);
    switch (msg.type) {
      case 'room_state': {
        state.connected = true;
        state.gotFirstState = true;
        state.room = msg.room;
        state.you = msg.you;
        state.phase = msg.phase;
        state.drawerId = msg.drawerId;
        state.deadline = msg.deadline;
        state.paused = msg.paused;
        state.pauseDeadline = msg.pauseDeadline;
        state.category = msg.category;
        state.choosing = Boolean(msg.choosing);
        state.hintText = '';
        state.wordMasked = msg.wordMasked || '';
        state.wordDescription = msg.wordDescription || '';
        state.players = msg.players || [];
        if (state.you) {
          state.nickname = state.you.nickname;
          state.guessed = state.you.guessed;
          // 本机收藏是偏好来源；认证完成后把当前装备同步给房间。
          setPenCursorSkin(penCollection.selected, { notifyRoom: true });
        }
        if (!state.shareUrl && msg.shareUrl) state.shareUrl = msg.shareUrl;
        if (state.roomCode && state.playerId) saveCredentials();

        if (state.phase === 'waiting') {
          showScreen('lobby');
          renderLobby();
        } else {
          showScreen('game');
          updateGameUI();
        }
        updateConnState();
        break;
      }

      case 'private_word':
        state.privateWord = msg.word;
        state.category = msg.category || state.category;
        state.choosing = false;
        updateGameUI();
        break;

      case 'word_options':
        state.choosing = true;
        state.wordOptions = msg.options || [];
        showWordChooser(msg);
        break;

      case 'draw_replay':
        board.replay(msg.events || []);
        break;

      case 'draw_event':
        board.applyEvent(msg.event);
        break;

      case 'phase_changed': {
        state.phase = msg.phase;
        state.drawerId = msg.drawerId;
        state.deadline = msg.deadline;
        state.paused = msg.paused;
        state.pauseDeadline = msg.pauseDeadline;
        state.category = msg.category || state.category;
        state.choosing = Boolean(msg.choosing);
        state.wordMasked = msg.wordMasked || '';
        state.wordDescription = msg.wordDescription || '';
        if (msg.round && state.room) state.room.round = msg.round;
        if (msg.totalRounds && state.room) state.room.totalRounds = msg.totalRounds;
        if (msg.turnInRound !== undefined && state.room) state.room.turnInRound = msg.turnInRound;
        if (msg.playersPerRound !== undefined && state.room) state.room.playersPerRound = msg.playersPerRound;
        if (msg.totalTurns !== undefined && state.room) state.room.totalTurns = msg.totalTurns;
        if (msg.clear) {
          board.reset();
          state.guessed = false;
          state.privateWord = '';
          state.wordOptions = [];
          state.hintText = '';
          if (state.you) state.you.guessed = false;
        }
        if (state.phase !== 'result' && state.phase !== 'finished') {
          state.currentArtwork = null;
          state.resultEndsAt = null;
          state.skipVotes = 0;
          state.skipRequired = 0;
          state.skipVoted = false;
        }
        if (state.phase === 'relay_collect') {
          setTimeout(() => maybeUploadRelayArtwork(), 250);
        }
        if (state.phase === 'waiting') {
          dismissLegendaryAnnouncement({ clearQueue: true });
          dismissGachaGrantAnnouncement({ clearQueue: true });
          hideOverlay();
          showScreen('lobby');
          renderLobby();
        } else {
          if (state.phase !== 'result' && state.phase !== 'finished' && state.phase !== 'relay_reveal') hideOverlay();
          showScreen('game');
          updateGameUI();
        }
        break;
      }

      case 'word_hint':
        state.hintText = msg.text || '';
        if (msg.masked !== undefined) state.wordMasked = msg.masked;
        state.wordDescription = msg.description || state.wordDescription;
        updateTopText();
        break;

      case 'players':
        state.players = msg.players || [];
        renderPlayerList();
        updateDrawOrder();
        $('#playerCount').textContent = state.players.length;
        updateGameUI();
        break;

      case 'pen_legendary_announce':
        // 发送者和其他房间成员统一走这里；announceId 会过滤发送者的服务端回声。
        showLegendaryAnnouncement(msg, { playSound: msg.playerId !== state.playerId });
        break;

      case 'pen_gacha_grant':
        handlePenGachaGrant(msg);
        break;

      case 'chat':
        addChat(msg);
        if (!msg.system) showBullet({ playerId: msg.playerId, nickname: msg.nickname, text: msg.text });
        break;

      case 'guess':
        addChat(msg);
        showBullet({ playerId: msg.playerId, nickname: msg.nickname, text: msg.text });
        break;

      case 'guess_result':
        if (msg.correct) {
          state.guessed = true;
          if (state.you) state.you.guessed = true;
          updateGameUI();
          toast(`🎉 猜中了！+${msg.points} 分`, 'ok');
        }
        break;

      case 'chat_blocked':
        toast(msg.message || '这条消息不能发送', 'error');
        break;

      case 'guess_correct':
        playCorrectGuessTone();
        addChat({ correct: true, nickname: '系统', text: `${msg.nickname} 猜中了！+${msg.points} 分` });
        showBullet({ correct: true, playerId: msg.playerId, nickname: msg.nickname, text: `🎉 ${msg.nickname} 猜中了！+${msg.points} 分` });
        break;

      case 'throw_item':
        showThrowEffect(msg.kind);
        if (msg.kind === 'flower') {
          addChat({ system: true, text: `${msg.nickname} 送了一束鲜花 🌸` });
        } else if (msg.kind === 'poop') {
          addChat({ system: true, text: `${msg.nickname} 丢了一坨大便 💩` });
        } else {
          addChat({ system: true, text: `${msg.nickname} 丢了一筐蔬菜 🥦` });
        }
        break;

      case 'meme_pack':
        showMemePack(msg);
        break;

      case 'relay_task':
        handleRelayTask(msg);
        break;

      case 'relay_collect':
        state.relayDidDraw = true;
        setTimeout(() => maybeUploadRelayArtwork(), 200);
        break;

      case 'relay_progress':
        if (state.relayTask) {
          state.relayTask.step = msg.step;
          state.relayTask.totalSteps = msg.totalSteps;
        }
        updateTopText();
        break;

      case 'relay_guess_done':
        toast('答案已提交', 'ok');
        $('#chatInput').value = '';
        break;

      case 'relay_upload_done':
        toast('缩略图已上传', 'ok');
        break;

      case 'relay_reveal':
        awardPenStardust(
          1,
          `${state.roomCode}:relay:${msg.gameSeq ?? 0}`,
          '完成一次传画接龙',
        );
        showRelayReveal(msg);
        break;

      case 'relay_rating':
        updateRelayRevealRating(msg);
        break;

      case 'round_result':
        state.phase = 'result';
        if (msg.reason !== 'rejoined') {
          awardPenStardust(
            1,
            `${state.roomCode}:g${msg.gameSeq ?? 0}:round:${msg.artworkId || `${msg.round}-${msg.turnInRound}`}`,
            '完成一幅作品',
          );
        }
        updateGameUI();
        showRoundResult(msg);
        break;

      case 'skip_vote_state':
        state.skipVotes = Number(msg.votes) || 0;
        state.skipRequired = Number(msg.required) || 0;
        state.skipVoted = Boolean(msg.voted);
        updateSkipVoteUI();
        break;

      case 'artwork_ready':
        if (state.currentArtwork && state.currentArtwork.id === msg.artworkId) {
          state.currentArtwork.thumbnail = msg.thumbnail;
          updateArtworkModal();
        }
        break;

      case 'artwork_rating':
        if (state.currentArtwork && state.currentArtwork.id === msg.artworkId) {
          state.currentArtwork.vegCount = msg.vegCount;
          state.currentArtwork.flowerCount = msg.flowerCount;
          if (msg.playerId === state.playerId) state.currentArtwork.myKind = msg.fromKind;
          updateArtworkModal();
        }
        break;

      case 'game_over': {
        state.phase = 'finished';
        awardPenStardust(
          2,
          `${state.roomCode}:game:${msg.gameSeq ?? 0}`,
          '完成整局游戏',
        );
        updateGameUI();
        showGameOver(msg);
        break;
      }

      case 'music_state':
        state.musicQueue = msg.queue || [];
        state.musicRoomCurrent = msg.current || null;
        renderMusicPanel();
        renderBiliPreview();
        renderGdResults();
        if (!state.musicCurrent) {
          const first = state.musicRoomCurrent || state.musicQueue[0];
          if (first && first.url) playMusic(first);
        }
        break;

      case 'music_gd_results':
        state.gdResults = msg.results || [];
        renderGdResults();
        break;

      case 'music_play':
        state.musicRoomCurrent = msg.song || null;
        renderMusicPanel();
        if (!state.musicCurrent && msg.song && msg.song.url) playMusic(msg.song);
        break;

      case 'music_stop':
        state.musicRoomCurrent = null;
        renderMusicPanel();
        break;

      case 'music_bili_resolved':
        state.biliResolved = { bvid: msg.bvid, info: msg.info || {}, ready: Boolean(msg.ready) };
        renderBiliPreview();
        break;

      case 'music_download_start':
        toast(msg.message || '开始下载，请稍候…', 'ok');
        break;

      case 'music_error':
        toast(msg.message || '音乐操作失败', 'error');
        break;

      case 'room_config':
        if (state.room) {
          state.room.drawSeconds = msg.config.drawSeconds;
          state.room.rounds = msg.config.rounds;
          state.room.wordMode = msg.config.wordMode;
          state.room.customWords = msg.config.customWords || [];
          state.room.customOnly = Boolean(msg.config.customOnly);
          state.room.wordPacks = { ...(msg.config.wordPacks || {}) };
          state.room.gameMode = msg.config.gameMode;
          state.room.relayPasses = msg.config.relayPasses;
          state.room.guessSeconds = msg.config.guessSeconds;
        }
        syncConfigUI();
        break;

      case 'error':
        if (msg.code === 'auth_failed') {
          toast(msg.message || '身份验证失败', 'error');
          resetToHome({ clearCredentials: true });
        } else {
          toastOnce(`error:${msg.code || msg.message}`, msg.message || '操作失败', 'error');
        }
        break;

      case 'kicked':
        toast(msg.message || '你已被移出房间', 'error');
        resetToHome({ clearCredentials: true });
        break;

      default:
        break;
    }
  }

  // ---------- 进入房间 ----------
  function enterRoom(data) {
    state.roomCode = data.room.code;
    state.shareUrl = data.shareUrl || `${location.origin}/?join=${data.room.code}`;
    state.playerId = data.player.id;
    state.token = data.player.token;
    state.nickname = data.player.nickname;
    state.you = { id: data.player.id, nickname: data.player.nickname, isHost: Boolean(data.player.isHost), score: 0, guessed: false };
    state.intentionalClose = false;
    state.gotFirstState = false;
    state.serverOffset = null;
    sessionStorage.removeItem('dg_duplicate');
    saveCredentials();
    localStorage.setItem('dg_nickname', state.nickname);
    history.replaceState(null, '', `/?join=${state.roomCode}`);
    showScreen('lobby');
    renderLobby();
    connectWS();
  }

  function autoRejoin(code, saved) {
    state.roomCode = code;
    state.playerId = saved.playerId;
    state.token = saved.token;
    state.nickname = saved.nickname || '玩家';
    state.shareUrl = `${location.origin}/?join=${code}`;
    state.intentionalClose = false;
    state.gotFirstState = false;
    state.serverOffset = null;
    history.replaceState(null, '', `/?join=${code}`);
    showScreen('lobby');
    renderLobby();
    connectWS();
  }

  // ---------- 首页在线房间 ----------
  let roomListTimer = null;

  async function joinRoomByCode(code, btn) {
    const nickname = $('#nicknameInput').value.trim() || '玩家';
    try {
      if (btn) btn.disabled = true;
      const data = await api(`/api/rooms/${code}/join`, { method: 'POST', body: { nickname } });
      enterRoom(data);
    } catch (err) {
      toast(err.message, 'error');
      if (btn) btn.disabled = false;
    }
  }

  async function refreshRoomList() {
    const box = $('#roomList');
    if (!box) return;
    try {
      const data = await api('/api/rooms');
      const rooms = data.rooms || [];
      box.innerHTML = '';
      const empty = $('#roomListEmpty');
      if (empty) empty.classList.toggle('hidden', rooms.length > 0);
      for (const room of rooms) {
        const li = document.createElement('li');
        li.className = 'room-list-item';
        const info = document.createElement('div');
        info.className = 'room-list-info';
        const codeSpan = document.createElement('span');
        codeSpan.className = 'room-list-code';
        codeSpan.textContent = room.code;
        const meta = document.createElement('span');
        meta.className = 'room-list-meta';
        const playing = room.status === 'playing' || (room.phase && room.phase !== 'waiting' && room.phase !== 'finished');
        const statusText = room.status === 'finished' ? '已结束' : (playing ? '游戏中' : '等待中');
        meta.textContent = `${statusText} · ${room.playerCount}/${room.maxPlayers}`;
        info.append(codeSpan, meta);
        const btn = document.createElement('button');
        btn.className = 'btn primary';
        btn.textContent = '加入';
        btn.addEventListener('click', () => joinRoomByCode(room.code, btn));
        li.append(info, btn);
        box.appendChild(li);
      }
    } catch {
      // 拉取房间列表失败时不打扰用户
    }
  }

  // ---------- 事件绑定 ----------
  function bindUI() {
    const nicknameInput = $('#nicknameInput');
    nicknameInput.value = localStorage.getItem('dg_nickname') || '';
    nicknameInput.addEventListener('input', () => localStorage.setItem('dg_nickname', nicknameInput.value.trim()));
    $('#homePenSkinBtn').addEventListener('click', () => showPenSkinModal());
    $('#lobbyPenSkinBtn').addEventListener('click', () => showPenSkinModal());
    $('#gamePenSkinBtn').addEventListener('click', () => showPenSkinModal());
    refreshRoomList();
    if (roomListTimer) clearInterval(roomListTimer);
    roomListTimer = setInterval(refreshRoomList, 5000);

    $('#createBtn').addEventListener('click', async () => {
      const nickname = nicknameInput.value.trim() || '玩家';
      const customCode = $('#customCodeInput').value.trim().toUpperCase();
      try {
        $('#createBtn').disabled = true;
        const data = await api('/api/rooms', { method: 'POST', body: { nickname, roomCode: customCode } });
        enterRoom(data);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        $('#createBtn').disabled = false;
      }
    });

    $('#joinBtn').addEventListener('click', async () => {
      const code = (state.pendingJoinCode || $('#roomCodeInput').value).trim().toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) {
        toast('请输入 4-8 位字母或数字房间码', 'error');
        return;
      }
      await joinRoomByCode(code, $('#joinBtn'));
    });

    $('#roomCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#joinBtn').click();
    });

    $('#copyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(state.shareUrl);
        toast('链接已复制', 'ok');
      } catch {
        $('#shareInput').select();
        document.execCommand('copy');
        toast('链接已复制', 'ok');
      }
    });

    $('#shareBtn').addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: '来玩你画我猜', text: '扫码或点链接加入，无需安装 APP', url: state.shareUrl });
        } catch {
          // 用户取消
        }
      } else {
        $('#copyBtn').click();
      }
    });

    $('#startBtn').addEventListener('click', () => send({ type: 'start_game' }));

    $('#roundsSelect').addEventListener('change', (e) => {
      send({ type: 'update_config', rounds: Number(e.target.value), drawSeconds: Number($('#secondsSelect').value) });
    });
    $('#secondsSelect').addEventListener('change', (e) => {
      send({ type: 'update_config', rounds: Number($('#roundsSelect').value), drawSeconds: Number(e.target.value) });
    });

    const sendWordBankConfig = () => {
      send({
        type: 'update_config',
        wordMode: $('#wordModeSelect').value,
        customOnly: $('#customOnlyCheck').checked,
        customWords: $('#customWordsInput').value,
        basicWords: $('#basicPackCheck').checked,
        lolWords: $('#lolPackCheck').checked,
        palworldWords: $('#palworldPackCheck').checked,
      });
    };
    $('#saveWordBankBtn').addEventListener('click', () => {
      sendWordBankConfig();
      toast('词库设置已保存', 'ok');
    });
    $('#wordModeSelect').addEventListener('change', sendWordBankConfig);
    $('#customOnlyCheck').addEventListener('change', sendWordBankConfig);
    $('#basicPackCheck').addEventListener('change', sendWordBankConfig);
    $('#lolPackCheck').addEventListener('change', sendWordBankConfig);
    $('#palworldPackCheck').addEventListener('change', sendWordBankConfig);
    $('#gameModeSelect').addEventListener('change', (e) => {
      $('#relaySettings').classList.toggle('hidden', e.target.value !== 'relay');
      send({ type: 'update_config', gameMode: e.target.value });
    });
    $('#relayPassesSelect').addEventListener('change', (e) => {
      send({ type: 'update_config', relayPasses: Number(e.target.value) });
    });
    $('#guessSecondsSelect').addEventListener('change', (e) => {
      send({ type: 'update_config', guessSeconds: Number(e.target.value) });
    });

    $('#leaveBtn').addEventListener('click', () => {
      send({ type: 'leave' });
      state.intentionalClose = true;
      if (state.roomCode) {
        localStorage.removeItem(`dg_player_${state.roomCode}`);
        if (localStorage.getItem('dg_last_room') === state.roomCode) localStorage.removeItem('dg_last_room');
      }
      if (state.ws) state.ws.close();
      resetToHome();
    });

    // 聊天 / 猜词提交：底部聊天框与移动端画布快速聊天条共用同一逻辑
    const submitMessage = (inputEl) => {
      if (composing) return;
      const text = inputEl.value.trim();
      if (!text) return;
      if (state.phase === 'relay_guess') {
        send({ type: 'relay_guess', text });
      } else {
        const guessMode = state.phase === 'drawing' && state.drawerId !== state.playerId && !state.guessed;
        send({ type: guessMode ? 'guess' : 'chat', text });
      }
      inputEl.value = '';
      const other = inputEl === $('#chatInput') ? $('#quickChatInput') : $('#chatInput');
      if (other) other.value = '';
      return true;
    };
    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      submitMessage($('#chatInput'));
    });
    const quickChatForm = $('#quickChatForm');
    if (quickChatForm) {
      quickChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $('#quickChatInput');
        if (submitMessage(input)) input.focus();
      });
    }

    // 音乐：B 站 BV 号解析 / 房主控制
    const resolveBili = () => {
      const bvid = $('#biliInput').value.trim();
      if (!bvid) {
        toast('请输入 BV 号', 'error');
        return;
      }
      send({ type: 'music_bili_resolve', bvid });
    };
    $('#biliResolveBtn').addEventListener('click', resolveBili);
    $('#biliInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        resolveBili();
      }
    });
    $('#musicEnableBtn').addEventListener('click', resumeLocalMusic);
    $('#musicSkipBtn').addEventListener('click', playNextLocalMusic);
    $('#musicStopBtn').addEventListener('click', () => {
      if (state.musicCurrent) stopMusic('stopped');
      else resumeLocalMusic();
    });

    // 音乐音量：本地记忆，只影响自己的设备
    const volumeEl = $('#musicVolume');
    const savedVolume = parseFloat(localStorage.getItem('dg_music_volume') || '1');
    if (Number.isFinite(savedVolume)) {
      const vol = Math.min(1, Math.max(0, savedVolume));
      musicAudio.volume = vol;
      if (volumeEl) volumeEl.value = String(vol);
      const volLabel = $('#musicVolumeLabel');
      if (volLabel) volLabel.textContent = `${Math.round(vol * 100)}%`;
    }
    if (volumeEl) {
      volumeEl.addEventListener('input', () => {
        const vol = Number(volumeEl.value);
        musicAudio.volume = vol;
        localStorage.setItem('dg_music_volume', String(vol));
        const volLabel = $('#musicVolumeLabel');
        if (volLabel) volLabel.textContent = `${Math.round(vol * 100)}%`;
      });
    }

    // 歌词外显开关 + 悬浮窗拖动
    const lyricsToggle = $('#lyricsFloatToggle');
    const floatLyricsEl = $('#floatLyrics');
    const updateLyricsToggleUI = () => {
      if (lyricsToggle) lyricsToggle.textContent = `歌词外显：${state.lyricsFloatOn ? '开' : '关'}`;
      updateFloatLyrics();
    };
    if (lyricsToggle) {
      lyricsToggle.addEventListener('click', () => {
        state.lyricsFloatOn = !state.lyricsFloatOn;
        localStorage.setItem('dg_float_lyrics', state.lyricsFloatOn ? '1' : '0');
        updateLyricsToggleUI();
      });
    }
    if (floatLyricsEl) {
      try {
        const pos = JSON.parse(localStorage.getItem('dg_float_lyrics_pos') || 'null');
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          floatLyricsEl.style.left = `${pos.x}px`;
          floatLyricsEl.style.top = `${pos.y}px`;
        }
      } catch {
        // 忽略损坏的位置记录
      }
      let drag = null;
      const startDrag = (e) => {
        if (floatLyricsEl.classList.contains('hidden')) return;
        const pt = e.touches ? e.touches[0] : e;
        drag = {
          dx: pt.clientX - floatLyricsEl.offsetLeft,
          dy: pt.clientY - floatLyricsEl.offsetTop,
        };
        e.preventDefault();
      };
      const moveDrag = (e) => {
        if (!drag) return;
        const pt = e.touches ? e.touches[0] : e;
        const x = Math.min(window.innerWidth - floatLyricsEl.offsetWidth, Math.max(0, pt.clientX - drag.dx));
        const y = Math.min(window.innerHeight - floatLyricsEl.offsetHeight, Math.max(0, pt.clientY - drag.dy));
        floatLyricsEl.style.left = `${x}px`;
        floatLyricsEl.style.top = `${y}px`;
        localStorage.setItem('dg_float_lyrics_pos', JSON.stringify({ x, y }));
        if (e.cancelable) e.preventDefault();
      };
      const endDrag = () => { drag = null; };
      floatLyricsEl.addEventListener('mousedown', startDrag);
      document.addEventListener('mousemove', moveDrag);
      document.addEventListener('mouseup', endDrag);
      floatLyricsEl.addEventListener('touchstart', startDrag, { passive: false });
      document.addEventListener('touchmove', moveDrag, { passive: false });
      document.addEventListener('touchend', endDrag);
      updateLyricsToggleUI();
    }

    // 音乐点歌源切换：GD音乐台 / B站 BV
    const setMusicSource = (source) => {
      state.musicSource = source;
      document.querySelectorAll('.music-source-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.source === source);
      });
      $('#gdPoint').classList.toggle('hidden', source !== 'gd');
      $('#biliPoint').classList.toggle('hidden', source !== 'bili');
    };
    document.querySelectorAll('.music-source-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMusicSource(btn.dataset.source));
    });

    // GD音乐台搜索
    const searchGd = () => {
      const q = $('#gdInput').value.trim();
      if (!q) {
        toast('请输入歌名或歌手', 'error');
        return;
      }
      send({ type: 'music_gd_search', q });
    };
    $('#gdSearchBtn').addEventListener('click', searchGd);
    $('#gdInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchGd();
      }
    });

    // 中文输入法：拼音确认中的回车不提交（底部框 + 移动端快速框共用）
    let composing = false;
    const chatInput = $('#chatInput');
    const quickChatInput = $('#quickChatInput');
    chatInput.addEventListener('compositionstart', () => { composing = true; });
    chatInput.addEventListener('compositionend', () => { composing = false; });
    if (quickChatInput) {
      quickChatInput.addEventListener('compositionstart', () => { composing = true; });
      quickChatInput.addEventListener('compositionend', () => { composing = false; });
    }
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && composing) e.stopPropagation();
    });
    if (quickChatInput) {
      quickChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && composing) e.stopPropagation();
      });
      // 两个输入框内容双向同步，切换输入位置不丢字
      chatInput.addEventListener('input', () => { quickChatInput.value = chatInput.value; });
      quickChatInput.addEventListener('input', () => { chatInput.value = quickChatInput.value; });
      // 让 visual viewport 先完成收缩，再把快捷输入栏保持在键盘上方。
      quickChatInput.addEventListener('focus', () => {
        setTimeout(() => {
          updateViewportMetrics();
        }, 80);
      });
      quickChatInput.addEventListener('blur', () => {
        setTimeout(updateViewportMetrics, 120);
      });
    }

    // 聊天 / 玩家 / 音乐 tab
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    // 工具栏
    buildTools();
    const mobileToolToggle = $('#mobileToolToggle');
    const drawerTools = $('#drawerTools');
    if (mobileToolToggle && drawerTools) {
      mobileToolToggle.addEventListener('click', () => {
        const collapsed = drawerTools.classList.toggle('mobile-tools-collapsed');
        mobileToolToggle.setAttribute('aria-expanded', String(!collapsed));
        mobileToolToggle.textContent = collapsed ? '🎨 工具' : '✕ 收起';
      });
    }

    $('#bulletToggle').addEventListener('click', () => {
      state.bulletsOn = !state.bulletsOn;
      localStorage.setItem('dg_bullets', state.bulletsOn ? '1' : '0');
      if (!state.bulletsOn) $('#bulletLayer').innerHTML = '';
      updateBulletUI();
    });

    const throwItem = (kind, btn) => {
      send({ type: 'throw_item', kind });
      btn.disabled = true;
      setTimeout(() => { btn.disabled = false; }, 1600);
    };
    $('#vegThrowBtn').addEventListener('click', (e) => throwItem('veg', e.currentTarget));
    $('#flowerThrowBtn').addEventListener('click', (e) => throwItem('flower', e.currentTarget));
    $('#poopThrowBtn').addEventListener('click', (e) => throwItem('poop', e.currentTarget));

    const memePackToggle = $('#memePackToggle');
    const memePackMenu = $('#memePackMenu');
    if (memePackToggle && memePackMenu) {
      memePackToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = memePackMenu.classList.toggle('hidden') === false;
        memePackToggle.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', (event) => {
        if (!memePackMenu.contains(event.target) && event.target !== memePackToggle) {
          memePackMenu.classList.add('hidden');
          memePackToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    $('#undoBtn').addEventListener('click', () => board.undo());
    $('#clearBtn').addEventListener('click', () => {
      if (confirm('确定清空画板？')) board.clear();
    });

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const shortcuts = {
        b: 'pen',
        g: 'bucket',
        r: 'rect',
        o: 'circle',
        t: 'triangle',
        v: 'select',
        e: 'eraser',
      };
      const tool = shortcuts[event.key.toLowerCase()];
      if (tool) {
        event.preventDefault();
        brush.tool = tool;
        if (tool !== 'select') board.clearSelection();
        updateToolActiveUI();
        return;
      }
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        const size = SIZES[Number(event.key) - 1];
        brush.size = size;
        document.querySelectorAll('.size-dot').forEach((button) => {
          button.classList.toggle('active', Number(button.dataset.size) === size);
        });
      }
    });

    // 自动加入：优先识别 ?join=CODE，其次恢复上次房间
    const directJoin = (code) => {
      state.pendingJoinCode = code;
      $('#roomCodeInput').classList.add('hidden');
      $('#customCodeInput').closest('.join-row').classList.add('hidden');
      $('#joinBtn').textContent = '进入房间';
      $('#homeTip').textContent = `将直接加入房间 ${code}，无需输入房间号`;
    };
    const autoJoinByCode = async (code) => {
      const nickname = (localStorage.getItem('dg_nickname') || '').trim();
      if (nickname) {
        try {
          const data = await api(`/api/rooms/${code}/join`, { method: 'POST', body: { nickname } });
          enterRoom(data);
          return;
        } catch (err) {
          toast(err.message, 'error');
        }
      }
      directJoin(code);
      nicknameInput.value = nickname || `玩家${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem('dg_nickname', nicknameInput.value.trim());
      nicknameInput.focus();
    };

    const params = new URLSearchParams(location.search);
    let joinCode = (params.get('join') || '').toUpperCase();
    if (!joinCode && !sessionStorage.getItem('dg_duplicate')) {
      joinCode = (localStorage.getItem('dg_last_room') || '').toUpperCase();
    }
    if (joinCode) {
      $('#roomCodeInput').value = joinCode;
      const saved = loadCredentials(joinCode);
      if (saved) {
        autoRejoin(joinCode, saved);
      } else {
        autoJoinByCode(joinCode);
      }
    }
  }

  function updateToolActiveUI() {
    document.querySelectorAll('.brush-tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === brush.tool);
    });
    const eraser = document.querySelector('.eraser-btn');
    if (eraser) eraser.classList.toggle('active', brush.tool === 'eraser');
    document.querySelectorAll('.swatch[data-color]').forEach((swatch) => {
      swatch.classList.toggle('active', !['eraser', 'select'].includes(brush.tool) && swatch.dataset.color === brush.color);
    });
    const canvas = $('#board');
    if (canvas) {
      canvas.classList.toggle('board-select-tool', brush.tool === 'select');
      canvas.classList.toggle('board-fill-tool', brush.tool === 'bucket');
    }
  }

  function buildTools() {
    const toolBox = $('#toolTools');
    toolBox.innerHTML = '';
    const TOOLS = [
      { id: 'pen', label: '普通', title: '普通画笔（B）' },
      { id: 'crayon', label: '蜡笔', title: '蜡笔' },
      { id: 'pixel', label: '像素', title: '像素画笔' },
      { id: 'highlighter', label: '荧光', title: '荧光笔' },
      { id: 'bucket', label: '🪣 油漆桶', title: '点击画布填充相连区域' },
      { id: 'rect', label: '▭ 矩形', title: '拖动绘制矩形（R）' },
      { id: 'circle', label: '○ 圆形', title: '拖动绘制圆形（O）' },
      { id: 'triangle', label: '△ 三角', title: '拖动绘制三角形（T）' },
      { id: 'select', label: '↗ 选择/拖动', title: '点选笔画，或拖出框选区域后移动' },
    ];
    TOOLS.forEach((tool) => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn brush-tool-btn';
      btn.textContent = tool.label;
      btn.dataset.tool = tool.id;
      if (tool.title) btn.title = tool.title;
      btn.addEventListener('click', () => {
        brush.tool = tool.id;
        if (tool.id !== 'select') board.clearSelection();
        updateToolActiveUI();
      });
      toolBox.appendChild(btn);
    });
    const penSkinBtn = document.createElement('button');
    penSkinBtn.id = 'penSkinToolBtn';
    penSkinBtn.type = 'button';
    penSkinBtn.className = 'tool-btn pen-skin-tool-btn';
    penSkinBtn.addEventListener('click', () => showPenSkinModal());
    toolBox.appendChild(penSkinBtn);
    updatePenSkinButton();

    const shortcutTip = document.createElement('span');
    shortcutTip.className = 'tool-shortcuts';
    shortcutTip.textContent = '快捷键 B 画笔 · G 油漆桶 · R 矩形 · O 圆形 · T 三角 · V 选择/拖动 · E 橡皮 · 1/2/3 粗细';
    toolBox.appendChild(shortcutTip);

    const colorBox = $('#colorTools');
    colorBox.innerHTML = '';

    const paletteToggle = document.createElement('button');
    paletteToggle.className = 'tool-btn palette-toggle';
    paletteToggle.type = 'button';
    paletteToggle.title = '打开调色盘';
    paletteToggle.setAttribute('aria-expanded', 'false');
    const paletteIcon = document.createElement('span');
    paletteIcon.textContent = '🎨';
    const paletteLabel = document.createElement('span');
    paletteLabel.textContent = '调色盘';
    const palettePreview = document.createElement('span');
    palettePreview.className = 'palette-toggle-color';
    palettePreview.style.background = brush.color;
    paletteToggle.append(paletteIcon, paletteLabel, palettePreview);

    const palettePanel = document.createElement('div');
    palettePanel.className = 'palette-panel hidden';
    const paletteGrid = document.createElement('div');
    paletteGrid.className = 'palette-grid';

    const colorInputRow = document.createElement('label');
    colorInputRow.className = 'palette-custom';
    const colorInputLabel = document.createElement('span');
    colorInputLabel.textContent = '自定义';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'palette-color-input';
    colorInput.value = brush.color;
    colorInput.title = '选择自定义颜色';
    colorInputRow.append(colorInputLabel, colorInput);

    const selectColor = (color) => {
      brush.color = color;
      brush.tool = 'pen';
      palettePreview.style.background = color;
      colorInput.value = color;
      updateToolActiveUI();
    };

    COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.className = 'swatch palette-swatch';
      btn.type = 'button';
      btn.style.background = color;
      btn.dataset.color = color;
      btn.title = color;
      btn.setAttribute('aria-label', `颜色 ${color}`);
      btn.addEventListener('click', () => {
        selectColor(color);
        palettePanel.classList.add('hidden');
        paletteToggle.setAttribute('aria-expanded', 'false');
      });
      paletteGrid.appendChild(btn);
    });

    colorInput.addEventListener('input', () => selectColor(colorInput.value));
    palettePanel.append(paletteGrid, colorInputRow);
    paletteToggle.addEventListener('click', () => {
      const open = palettePanel.classList.toggle('hidden') === false;
      paletteToggle.setAttribute('aria-expanded', String(open));
    });
    colorBox.appendChild(paletteToggle);

    QUICK_COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.className = 'swatch';
      btn.type = 'button';
      btn.style.background = color;
      btn.dataset.color = color;
      btn.title = color;
      btn.setAttribute('aria-label', `颜色 ${color}`);
      btn.addEventListener('click', () => selectColor(color));
      colorBox.appendChild(btn);
    });

    const eraser = document.createElement('button');
    eraser.className = 'swatch eraser-btn';
    eraser.type = 'button';
    eraser.style.background = '#ffffff';
    eraser.textContent = '🧽';
    eraser.title = '橡皮擦（E）';
    eraser.addEventListener('click', () => {
      brush.tool = 'eraser';
      document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      updateToolActiveUI();
    });
    colorBox.appendChild(eraser);
    colorBox.appendChild(palettePanel);

    const sizeBox = $('#sizeTools');
    sizeBox.innerHTML = '';
    const labels = ['细', '中', '粗'];
    SIZES.forEach((size, i) => {
      const btn = document.createElement('button');
      btn.className = 'size-dot';
      btn.textContent = labels[i];
      btn.dataset.size = String(size);
      btn.addEventListener('click', () => {
        brush.size = size;
        document.querySelectorAll('.size-dot').forEach((s) => s.classList.remove('active'));
        btn.classList.add('active');
      });
      if (size === brush.size) btn.classList.add('active');
      sizeBox.appendChild(btn);
    });

    updateToolActiveUI();
  }

  // ---------- 启动 ----------
  bindViewportMetrics();
  setPenCursorSkin(penCollection.selected);
  loadMemePacks();
  bindUI();
  updateBulletUI();
  showScreen('home');
  updateConnState();
})();
