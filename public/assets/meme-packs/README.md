# MEME 弹幕包

每个包由一张会自动循环播放的真实 meme GIF 和一段真实来源的梗音组成（源 MP3；浏览器兼容性需要时做本地转码），音频表情包最长 5 秒，配对关系记录在 `manifest.json`。弹幕只需要携带 `packId`，客户端再按清单加载本地媒体。

## 当前 30 个包

| packId | 画面 | 音效用途 |
| --- | --- | --- |
| `impact-boom-01` | 震撼一击 | 低频冲击、短促爆点 |
| `deadpan-drop-01` | 冷静下坠 | 低沉滑落、无语反应 |
| `party-horn-01` | 派对号角 | 号角、庆祝 |
| `fail-buzzer-01` | 失败蜂鸣 | 红叉、失败提示 |
| `surprise-rise-01` | 等等什么 | 上扬惊讶 |
| `victory-fanfare-01` | 这波赢麻了 | 四音胜利号角 |
| `emotional-damage-02` | 破防暴击 | Emotional Damage |
| `bonk-doge-02` | 狗头制裁 | BONK |
| `coffin-dance-02` | 棺材舞送走 | Coffin Dance |
| `gta-wasted-02` | 当场寄 | GTA Wasted |
| `fbi-open-up-02` | 破门突袭 | FBI Open Up |
| `sad-violin-02` | 悲情拉满 | Sad Violin |
| `among-us-emergency-03` | 紧急会议 | Among Us Emergency |
| `why-running-03` | 为什么要跑 | Why Are You Running |
| `cut-g-03` | 这发型可以 | I Like Your Cut G |
| `trololo-03` | 魔性洗脑 | Trololo |
| `its-corn-03` | 玉米之歌 | It’s Corn |
| `happy-happy-03` | 开心连击 | Happy Happy Happy |
| `few-moments-later-04` | 过了一会儿 | A Few Moments Later |
| `hello-there-04` | 老朋友登场 | Hello There |
| `john-cena-04` | 隐形登场 | John Cena Intro |
| `mario-falling-04` | 坠落失误 | Mario Oof |
| `just-kidding-04` | 逗你玩的 | Sike |
| `turtles-04` | 我喜欢海龟 | I Like Turtles |
| `crab-rave-05` | 螃蟹开趴 | Crab Rave |
| `crazy-frog-05` | 蛙式乱入 | Crazy Frog |
| `badum-tss-05` | 笑点收尾 | Ba Dum Tss / Rimshot |
| `hog-rider-05` | 野猪冲锋 | Hog Rider |
| `goofy-yell-05` | 高飞怪叫 | Goofy Yell |
| `kirby-falls-05` | 卡比坠落（kirby died f） | 用户指定 B 站视频音效 |

## 来源和授权

图片改为各音效对应页面或相关 meme 音效按钮使用的真实多帧 GIF，包括首批、第二批、第三批、第四批和第五批；浏览器会自动播放并按源 GIF 的循环设置重复。第五批加入 Crab Rave、Crazy Frog、Ba Dum Tss、Hog Rider、Goofy Yell 和 Kirby Falls，保持轻松的反应与庆祝用途。音效使用公开音效库中的真实梗音源，Sike 为同一源音效的浏览器兼容 WAV 转码。每张图片和每条音效都在 `manifest.json` 里保留了来源直链和来源页面。它们可以用于本地项目预览，但发布前仍要按各来源站点的条款确认再分发范围。

之前生成的镜头平移动效已移到 `images/_legacy-derived-motion/`，不会再被当前预览使用。
