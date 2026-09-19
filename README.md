# 你画我猜 · 网页版（免 APP）

一个可直接运行的“你画我猜”MVP：房主创建房间后生成 **二维码/链接**，其他人用手机扫码或点链接，在浏览器里即可加入。手机和 PC 同房游玩，支持实时画板、猜词、计分、断线重连。

## 功能

- 创建房间，生成房间码 + 二维码 + 分享链接；支持自定义 4-8 位房间号
- 画手每轮可 3 选 1 选题，也可切换为系统随机出题
- 房主可添加自定义词库，每行一个词；可选填提示，格式 `词语|提示`；可选“仅使用自定义词库”
- 手机扫码 / PC 点链接直接加入，无需安装 APP
- 鼠标 / 触屏 / 触控笔作画（Pointer Events）
- 画笔颜色、粗细、普通/蜡笔/像素/荧光笔、矩形/圆形/三角形、橡皮、油漆桶、选择拖动、撤销、清空
- 结算页显示猜中时间排行榜
- 实时笔画同步，新加入者自动回放当前画板
- 基础词库按可画性整理为动物 / 食物 / 物品 / 动作 / 场景 / 职业 / 虚拟人物 / 成语 / 情绪 / 网络梗等类别；英雄联盟、幻兽帕鲁题库从外部 JSON 加载并可开关
- 基础内置题统一定位为中等难度，使用 2-6 个字、画面锚点明确的固定词 / 短语，避免开放式句子；画手 3 选 1 时尽量提供不同类别
- 三选一展示过的候选题会记为当前房间的已曝光题目，跨“再来一局”和返回房间后重开仍不会再次出现，避免其他玩家因见过落选选项而获得优势；题池耗尽后自动开启下一轮题目循环
- 猜中自动计分，剩余时间越多得分越高
- 聊天/猜词以弹幕形式飘过画板，可一键屏蔽弹幕
- 可丢蔬菜/送鲜花/丢大便互动，特效从画板上飘落；互动不影响分数和画作评价
- 每回合结束展示画作缩略图与作画过程回放；全部猜中触发鲜花扩散特效
- 回合结算页支持在线玩家多数投票跳过等待，票数达标后立即进入下一回合或最终排名
- 玩家可给画作送蔬菜/鲜花，并可下载保存作品
- 终局展示本局画廊排名，评选最快猜中、最难看出、画得最好、最奇葩
- 点歌队列：游戏开始后人人可点歌，支持网易云搜索、GD音乐台（含歌词）与 B 站 BV 号，房间共享队列、各设备独立播放和切歌，歌曲自然播放完会自动从房间队列消费；B 站支持多解析源自动兜底
- 分享链接打开后无需输入房间号，填写昵称即可直接进房
- 经典模式：轮换画手；一轮 = 每位玩家都画过一次，界面显示作画顺序
- 传画接龙模式：每人秘密作画 → 传递画作猜词 → 再画 → 最终揭晓链条并投票
- 题目居中放大显示，提示单独显示在题目下方
- 断线自动重连，画手掉线暂停等待，房主掉线自动移交
- 手机 / 平板竖横屏 / PC 宽屏响应式布局，移动端带输入法避让的快捷输入栏

## 快速开始

要求：Node.js 18 或更高版本。

```bash
npm install
npm start
```

然后打开：

```
http://localhost:3000
```

Windows 用户也可以直接双击 `start.bat`。启动器默认使用 3000 端口，支持选择端口、启动服务、关闭服务和打开游戏页面；服务运行后关闭启动器窗口不会停止游戏，重新打开启动器仍可继续管理同一个服务。

### 让同一个 WiFi 下的朋友加入

1. 查看本机局域网 IP，例如 Windows 执行 `ipconfig`，找到 `192.168.x.x`；
2. 朋友在浏览器打开 `http://192.168.x.x:3000`；
3. 或者房主把二维码/链接发给朋友。

> 注意：手机和电脑需要在同一个局域网内。房主从 `http://localhost:3000` 创建房间时，二维码会自动改用检测到的局域网 IPv4；如果电脑有多个网卡，可设置 `LAN_HOST` 指定手机实际可访问的地址。

### 让外网朋友加入：内网穿透

本项目启动后监听 3000 端口。任选一个内网穿透工具即可，**不需要改路由器、不需要公网 IP**。

Cloudflare Tunnel：

```bash
cloudflared tunnel --url http://localhost:3000
```

cpolar（国内网络推荐）：

```bash
cpolar http 3000
```

ngrok：

```bash
ngrok http 3000
```

启动后工具会输出一个公网 HTTPS 地址，例如：

```
https://xxxx.trycloudflare.com
```

把该地址发到手机，或直接用该地址创建房间。服务端会识别穿透请求的 Host 和协议，自动生成对应域名的二维码与分享链接。

如果穿透工具输出的地址是固定的，也可以写死：

```bash
# Windows PowerShell
$env:PUBLIC_BASE_URL="https://your-domain.example.com"
npm start
```

```bash
# Linux / macOS
PUBLIC_BASE_URL=https://your-domain.example.com npm start
```

## 玩法

1. 房主填写昵称，点击“创建房间”；
2. 大厅展示二维码和链接，设置轮数 / 每轮秒数；
3. 其他人扫码或点链接，输入昵称加入；
4. 至少 2 名在线玩家后，房主点击“开始游戏”；
5. 每轮随机指定画手，画手看题作画，其他玩家输入答案；
6. 全部猜中或倒计时结束，公布答案和得分；全部轮次结束后显示排名。

## 项目结构

```
.
├── server.js        # Node 服务端：HTTP API + WebSocket + 房间/回合状态机
├── word-packs.js    # 外部 JSON 词库加载、校验与热读取
├── words.js         # 中文 / 英文词库与答案别名
├── data/
│   └── word-packs/  # manifest.json、英雄联盟和幻兽帕鲁外部词库
├── scripts/
│   └── audit-words.mjs # 题库重复、元数据、分类提示和别名检查
├── public/
│   ├── index.html   # 页面结构
│   ├── style.css    # PC / 手机响应式样式
│   └── app.js       # 画板引擎、WebSocket 客户端、界面逻辑
├── package.json
└── start.bat        # Windows 一键启动
```

题库维护后可运行 `npm run audit:words`，检查重复题、缺少难度/可画性、缺少分类提示和失效别名。

### 外部 JSON 词库与热读取

服务端启动时读取 `data/word-packs/manifest.json`，目前包含 `lol.json` 和 `palworld.json`。manifest 的 `enabledByDefault` 控制新房间是否默认勾选该词库。编辑这些文件并保存后，服务端会自动防抖重读；校验成功后原子切换到新注册表，控制台会输出新的词库版本号。JSON 格式错误时继续使用上一版可用词库，不会中断游戏服务。

正在进行的对局固定开始时的词库快照；热读取结果会在新房间或下一局开始时生效。词库目录状态可通过 `GET /api/word-packs` 查看，接口只返回名称、版本和题目数量，不暴露题目内容。

每个词库需要 `schemaVersion: 1`、稳定的 `id`、`name`、`version`、`locale` 和 `groups`；分类中使用 `words` 或 `entries` 数组，题目可配置 `aliases`、`difficulty`、`drawability`、`hint` 和 `clue`。只允许读取 manifest 登记的 JSON 文件，单文件上限为 2 MB。

## 常用配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket 监听端口 |
| `PUBLIC_BASE_URL` | 自动识别 | 固定二维码/分享链接域名 |
| `LAN_HOST` | 自动探测 | localhost 创建房间时，二维码使用的局域网 IPv4；多网卡时可手动指定 |
| `MUSIC_CACHE_MAX_MB` | `2048` | 音乐下载缓存上限（MB），超出自动清理最久未播的歌 |
| `BILI_MAX_DURATION` | `600` | BV 号点歌允许的最大视频时长（秒） |
| `BILI_DOWNLOAD_TIMEOUT` | `120000` | 单个 BV 下载超时（毫秒） |
| `BILI_API_TIMEOUT` | `15000` | B 站官方接口单次请求超时（毫秒） |
| `BILI_COOKIE` | 空 | 可选 B 站 Cookie，登录/风控/地区限制时使用 |
| `BILI_COOKIE_FILE` | 空 | 可选 Netscape 格式 Cookie 文件路径，供 yt-dlp 使用 |
| `BILI_PROXY` | 空 | 可选代理地址，B 站网络不稳定时使用 |
| `BILI_USER_AGENT` | `Mozilla/5.0` | 可选 B 站请求 User-Agent |
| `FFMPEG_PATH` | 自动 | ffmpeg/ffprobe 所在目录，转 mp3 需要 |
| `MUSIC_API_BASE` | `http://127.0.0.1:3001` | 自建 NeteaseCloudMusicApi 服务地址，网易云点歌需要 |
| `MUSIC_NETEASE_COOKIE` | 空 | 网易云登录 Cookie（只需 `MUSIC_U=xxx`，会员 Cookie 可获取完整歌曲而非试听） |
| `MUSIC_NETEASE_UNBLOCK` | `1` | 是否启用网易云 API 的解灰/解锁（`0` 关闭），官方只返回试听时会自动尝试 |
| `MUSIC_NETEASE_MATCH_SOURCES` | 空 | 解灰音源列表（逗号分隔，如 `byfuns,gdmusic,msls,qijieya,unm`），留空自动尝试 |
| `MUSIC_NETEASE_ALLOW_TRIAL` | `0` | 完整版获取不到时是否允许缓存试听片段（界面会标“试听”） |
| `MUSIC_NETEASE_TIMEOUT` | `25000` | 网易云 API / 音频下载超时（毫秒） |
| `MUSIC_GD_MUSIC_ENABLED` | `1` | 是否启用 GD音乐台点歌源（`0` 关闭） |
| `MUSIC_GD_MUSIC_BASE` | `https://music-api.gdstudio.xyz` | GD音乐台 API 服务地址 |

> BV 号点歌会依次尝试：`yt-dlp` 主链路、B23 短链 + IPv4 重试、B站官方播放流 + ffmpeg 转码。建议仍先在服务器/电脑上安装 `yt-dlp` 并加入 PATH：
> ```bash
> pip install yt-dlp
> ```
> 如果下载时报 `ffprobe and ffmpeg not found`，请安装 ffmpeg，并把含 `ffmpeg.exe` / `ffprobe.exe` 的目录配置到环境变量 `FFMPEG_PATH`。官方播放流兜底也需要 ffmpeg；遇到登录或风控限制时，可配置 `BILI_COOKIE` 或 `BILI_COOKIE_FILE`，网络不稳定时可配置 `BILI_PROXY`。
>
> 网易云点歌需要额外部署 NeteaseCloudMusicApi：
> ```bash
> git clone https://github.com/Binaryify/NeteaseCloudMusicApi.git
> cd NeteaseCloudMusicApi
> npm install
> npm start
> ```
> 默认跑在 `http://127.0.0.1:3001`，与本项目的 `MUSIC_API_BASE` 一致。
>
> GD音乐台点歌源无需额外部署任何服务，直接走 `MUSIC_GD_MUSIC_BASE` 解析音频并提供 LRC 歌词，适合作为网易云缺失时的备用解析源。
>
> 如果你用的是 **NeteaseCloudMusicApi Enhanced**（页面标题含 “网易云音乐 API Enhanced”），本项目会自动使用它的 `unblock=true` 和 `/song/url/match` 解灰能力。
>
> 关于“只能获取试听片段”：网易云对未登录/非会员账号的很多歌曲只返回 30 秒左右试听。最可靠的解决方式是在浏览器登录网易云后，把 Cookie 里的 `MUSIC_U` 值配到环境变量：
> ```bat
> set MUSIC_NETEASE_COOKIE=MUSIC_U=你的MUSIC_U值
> ```
> 有会员的账号通常就能返回完整歌曲。若仍取不到完整版，可开启 `MUSIC_NETEASE_ALLOW_TRIAL=1` 允许播放试听片段（界面会标注“试听”）。

## 技术要点

- 服务端权威状态机：`等待 → 看题(3s) → 作画 → 结算(8s) → 下一轮/终局`
- 画图同步使用归一化坐标 + 事件流（begin / points / end / undo / clear），新加入者增量回放
- 音乐只同步房间队列与歌曲资源，不同步跨设备播放进度；播放、暂停、切歌和音量由各设备本地控制
- WebSocket 心跳 30 秒，客户端断线自动重连
- 二维码内容为标准 HTTPS 链接，系统相机扫码后直接用浏览器打开
- 当前版本适合朋友局 / 内网穿透 / 中小规模房间；正式运营建议迁移到云服务器 + Redis 扩展
