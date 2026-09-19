# 速成你画我猜

一个免安装 App 的网页你画我猜：房主创建房间后分享二维码或链接，朋友用手机、平板或电脑浏览器即可加入。项目面向朋友局、局域网和小规模内网穿透场景。

## 功能

- 房间码、二维码和分享链接，扫码即可加入
- 手机、平板、电脑响应式界面，支持触摸、鼠标和触控笔
- 普通画笔、蜡笔、像素笔、荧光笔、橡皮、油漆桶
- 矩形、圆形、三角形、选择拖动、撤销和清空画板
- 实时画板同步，后加入的玩家自动回放当前画作
- 经典你画我猜和传画接龙
- 轮数、倒计时、选词方式和题库开关
- 外部 JSON 词库热读取，当前附带《英雄联盟》和《幻兽帕鲁》词库
- GIF + 音效 MEME 弹幕包
- 传说笔皮肤、抽卡和全房间获得提示
- 聊天弹幕、鲜花、蔬菜和其他轻量互动
- 回合回放、结算排行榜和最终画廊
- 可选点歌队列：网易云、GD 音乐台和 B 站 BV 号

## 环境要求

- Node.js 18 或更高版本
- Windows 使用 `start.bat` 时需要 PowerShell
- 点歌功能需要额外安装 `yt-dlp`；需要转码时还要安装 `ffmpeg`

## 快速开始

在项目目录执行：

`bash
npm install
npm start
`

然后打开：

`text
http://localhost:3000
`

Windows 用户也可以双击 `start.bat`。启动器默认端口是 `3000`，可以启动、关闭服务并切换端口。

## 局域网游玩

1. 在主机上启动服务。
2. Windows 执行 `ipconfig`，找到主机的局域网 IPv4 地址。
3. 同一 Wi-Fi 下的朋友打开 `http://局域网IP:3000`，或者直接扫描大厅二维码。

例如：

`text
http://192.168.x.x:3000
`

房主从 `localhost` 创建房间时，服务端会尝试把二维码和分享链接改成局域网地址。如果电脑有多个网卡，可以设置：

`powershell
$env:LAN_HOST = "192.168.1.100"
npm start
`

## 外网访问

服务端只监听本机端口，外网访问需要使用你信任的内网穿透工具。下面命令仅是示例：

`bash
cloudflared tunnel --url http://localhost:3000
cpolar http 3000
ngrok http 3000
`

把工具生成的 HTTPS 地址发给朋友即可。若有固定域名，可以设置：

`powershell
$env:PUBLIC_BASE_URL = "https://your-domain.example.com"
npm start
`

不要把带有个人账号、Cookie 或访问令牌的穿透配置提交到 Git 仓库。

## 题库

题库清单在 `data/word-packs/manifest.json`，当前包含：

- `data/word-packs/lol.json`
- `data/word-packs/palworld.json`

编辑 JSON 并保存后，服务端会自动防抖重读。校验通过的新版本会在新房间或下一局开始时生效；如果 JSON 有错误，会继续使用上一版可用词库，不会让服务停止。

维护词库后可以运行：

`bash
npm run audit:words
`

## MEME 和笔皮肤资源

- `public/assets/meme-packs/manifest.json`：GIF、音效和配对关系
- `public/assets/meme-packs/README.md`：当前音频表情包清单和来源说明
- `public/assets/pen-skins/manifest.json`：笔皮肤清单
- `PEN_SKIN_ADDING_GUIDE.md`：添加新笔皮肤的步骤和规范

部分 MEME、音效和角色视觉素材来自第三方。仓库中的来源记录只用于追溯，不代表项目取得了所有素材的再分发授权。公开发布前，请按来源页面的许可条款逐项确认。

## 可选点歌配置

常用环境变量：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 和 WebSocket 端口 |
| `PUBLIC_BASE_URL` | 自动识别 | 二维码和分享链接使用的固定地址 |
| `LAN_HOST` | 自动探测 | 主机局域网地址 |
| `MUSIC_API_BASE` | `http://127.0.0.1:3001` | 网易云 API 地址 |
| `MUSIC_GD_MUSIC_ENABLED` | `1` | 是否启用 GD 音乐台 |
| `BILI_MAX_DURATION` | `600` | B 站视频最长允许时长，单位为秒 |
| `FFMPEG_PATH` | 自动查找 | `ffmpeg.exe` 和 `ffprobe.exe` 所在目录 |

网易云 Cookie、B 站 Cookie、代理地址和其他凭据只能通过环境变量提供，例如：

`powershell
$env:MUSIC_NETEASE_COOKIE = "MUSIC_U=你的值"
$env:BILI_COOKIE = "你的值"
npm start
`

这些值不要写进源码、README、截图或提交记录。`.env` 和 `.env.*` 已加入 `.gitignore`。

## 项目结构

`text
.
├── server.js                 # HTTP API、WebSocket 和房间状态机
├── public/
│   ├── index.html             # 页面结构
│   ├── style.css              # PC / 移动端样式
│   ├── app.js                 # 画板、房间和客户端逻辑
│   └── assets/                # MEME、音效、笔皮肤
├── data/word-packs/           # 外部 JSON 词库
├── scripts/                   # 题库检查和资源处理脚本
├── launcher.ps1               # Windows 启动器逻辑
├── start.bat                  # Windows 一键启动
├── package.json
└── package-lock.json
`

## 安全和隐私

- 项目没有账号系统，房间状态默认只保存在服务进程内存中。
- 玩家重连凭据是服务端临时生成的房间令牌，不应复制到公开日志或截图。
- 不要把服务端直接暴露到不受信任的公网；外网游玩建议使用 HTTPS 穿透，并限制房间分享范围。
- 不要提交 `.env`、Cookie、访问令牌、浏览器配置目录、缓存、日志、PID 文件和本地隧道程序。
- 当前仓库已排除 `node_modules`、`cache`、`speed-typing`、`cloudflared.exe`、日志、PID 文件和宣传录制用浏览器配置。

## 开发检查

`bash
node --check server.js
node --check public/app.js
npm run audit:words
`

如果修改了前端文件，浏览器可以使用 `Ctrl+F5` 强制刷新。服务端运行日志默认写入本地文件，不应上传到公开仓库。

## 许可说明

本项目代码目前未附带独立开源许可证。第三方 MEME、音效、角色和品牌素材可能受各自版权、商标或站点条款约束；再分发前请自行确认许可范围。
