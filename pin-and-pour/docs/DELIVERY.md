# PIN & POUR 交付说明（pin-and-pour）

> 端到端 agent 交付 · 2026-11-19 · 源码改造自 `local/src1/拉针游戏3.0/`

## 1) 源码分析摘要（原作玩法事实）

参考 Cocos 3.0「拉针游戏3.0」，核心是「拉针 → 球在重力下流动 → 落点判定胜负」。

| 事实 | 源码位置 |
| --- | --- |
| 点击/触摸插销抽出（`pin.movePin()` + `isPulled=true`） | `assets/Scripts/GameController.ts:72-111` |
| 金球（gold）落地 = win，靠碰撞检测 `contactGround/goldOnGroundCheck` | `GameController.ts:150-169` |
| 三种插销：横(`Pin.ts`)、竖(`Pin_Vertical.ts`)、斜(`Pin_Diagonal.ts`)，都用 tween 滑动抽出 | `Pin.ts:55-62`、`Pin_Vertical.ts:22-36`、`Pin_Diagonal.ts:28-43` |
| 第 2 关「双针顺序」：必须先抽横针再抽竖针，顺序错即无解 | `GameController_level2.ts:88-97` |
| 第 3 关「三斜针 + 岩石」：金球落岩石 = loss，落地面 = win | `GameController_level3.ts:181-195` |
| 第 4 关「左右地面」：金球落右地面 = win，落左地面 = loss | `GameController_level4.ts:138-166` |
| 第 5 关「竖针 + 两横针 + stone/dragon」：金球落 dragon = win，落 stone = loss | `GameController_level5.ts:173-201` |
| 结算卡：win/lose 文案 + 下一关/重玩按钮 | `GameOver.ts:39-65` |

**玩法规则 P0 还原**：竖直容器场景、点插销抽出、物体在重力下流动、把「宝物」导入收集区过关、把「危险物」引到安全区、拉错顺序=失败。物理用自写确定性网格模拟（蜂蜜珠子 + 气泡珠子，不引 Matter.js），符合 repo 纯逻辑惯例。

## 2) 改造点清单

**保留**：拉针=抽闸板的「顺序即策略」核心；落点判定胜负；失败快速重开；12 关推进结构；三章换场景。

**改写**：
- 主题原创为「蜜糖工坊分装台」：金蜂蜜（宝物流体）、气泡（危险，污染蜂蜜）、蜂巢块、玻璃分装瓶、深色排口。
- 三种插销简化为统一「木闸板」，另新增两类格子：`comb`（蜂巢块，蜂蜜可穿过并冲走，气泡视为墙）与 `screen`（滤网，气泡可穿过，蜂蜜视为墙）——用类型化的流动规则制造顺序陷阱。
- 物理为纯逻辑确定性模拟：珠子 2D 网格下落（先竖直再斜向铺开），蜂蜜进瓶=收集、气泡进瓶=污染 lose、蜂蜜进排口=浪费 lose、气泡进排口=安全。
- 12 关手工设计，全部由 `src/game/level.js` 的 BFS solver 验证可解并给出最小抽闸顺序；`par` = 最小干净解长度。

**原创**：三场景包（晨间蜂场/午后工坊/夜幕蜜窖）、程序化 Canvas 美术、程序化 WebAudio 音频、蜂蜜拉丝 + 落瓶琥珀光 signature、首次交互引导。

## 3) 门禁最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 26 pass / 0 fail |
| `tools/selfplay.mjs` | ✅ 3 策略遥测写入 autoplay.json |
| `fun-audit` | ✅ PASS 100/100（26 pass） |
| `fun-report` | ✅ PASS（10 pass / 0 warn / 0 fail） |
| `verify-game` | ✅ PASS（60fps、0 console/page error、0 失败请求） |
| `i18n-check` | ✅ OK（en/zh 各 33 key，无缺失/空值） |
| `tutorial-check` | ✅ PASS（3 步、可跳过、持久化、可重看） |
| `sdk-check` | ✅ PASS（SDK 就绪/降级/广告关闭安全返回/埋点/存档/分享） |
| `audio-check` | ✅ PASS（BGM 40s 无缝循环 + 9 类 SFX 全部 RMS/时长/峰值达标） |
| `vision-review` | ✅ WARN（readable 7.8 / silhouette 6.8 / style 8.6，无 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）
- `game.gif`（480×270、4.5s 循环、~296KB，前 3 秒即见拉闸→流动→装瓶）
- `icon.png`（256×256）、`favicon.png`（64×64）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份）

## 5) 未做项与已知问题

- **未做**：广告账号未接（`sdk.config.js` 的 `ads.enabled=false`）；ja/ko/ar/ru 未翻译（只暴露 en/zh，按铁律整块不暴露）；未跑线上发布/上传（本任务禁 commit、禁常驻服务器）。
- **已知问题**：vision-review 为 WARN——minor 项集中在「HUD 字号偏小、箭头与图标间距偏紧、背景装饰剪影偏简」；L3/L5/L12 各有一根冗余闸（红鲱鱼，不影响可解性与 par）。

## 6) 最不满意的一处

1–2 列的窄关卡（L1/L9 等）在竖屏容器里偏瘦长，视觉模型仍觉得像「中央竖条」而非「一眼就懂的分装台」——虽然加了不透明内壁 + 目标图例后已过 WARN，但离「3 秒读懂的桌面感」还有距离，下一次会把窄关卡换成更宽的 3 列版式或给容器加固定宽度的机器侧板。
