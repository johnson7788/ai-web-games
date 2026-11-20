# BRAIN TEASE · 交付报告

- slug：`brain-tease` · title：`BRAIN TEASE` · appId：`pipy-brain-tease`
- 改造自：《测试脑力-益智小游戏》（源码仅 `GameJsCfg.js` 一个文案文件，5 关坑爹解谜）
- 交付日期：2026-11-20

## 1) 文件清单

```
games/brain-tease/
├─ index.html / styles.css / package.json
├─ config/
│   ├─ game.config.js        世界尺寸 / 步长 / 语言 / 存档键
│   ├─ design.json           机器可读设计源（fun-audit 100/100）
│   ├─ levels.js             24 关原创谜题（en/zh 双语 goal/hint/roast/物体）
│   ├─ locales.js            en/zh 全平铺 UI 文案（50 key × 2）
│   └─ sdk.config.js         appId / 广告 / 埋点 / 存档 / 分享（source:local）
├─ src/
│   ├─ main.js               装配 / 固定步长 / 手势 / 状态机 / __ll 契约 / boot 守卫
│   ├─ core/i18n.js          语言切换（?lang / localStorage / 默认 en）
│   ├─ core/sdk.js           SDK 唯一出口（广告/埋点/存档/分享 + 降级）
│   ├─ core/audio.js         程序化 WebAudio（14 SFX + BGM/环境 2 循环层）
│   ├─ vendor/pipysdk.js     站点 SDK（vendored；runtimeConfigUrl/appConfigUrl 已清空）
│   ├─ game/sim.js           纯逻辑谜题引擎（手势→解法匹配 / 整蛊计 / 星数）
│   ├─ game/rng.js           mulberry32
│   ├─ render/theme.js       4 套场景包色板
│   ├─ render/index.js       Canvas 程序化渲染（场景 + 机关 + 博士）
│   └─ ui/{index,tutorial}.js 屏幕 / HUD / 目标横幅 / 首次引导（3 步状态机）
├─ tests/                    sim.test.mjs + levels.test.mjs（23 条）
├─ tools/
│   ├─ verify.plan.json      浏览器验收计划
│   ├─ selfplay.mjs          3 策略遥测
│   ├─ audio-check.mjs       音效离线校验
│   ├─ capture-final.mjs     生成 tests/final/*.png
│   ├─ record-gif.mjs        录制 game.gif
│   └─ make-poster.mjs       生成 poster.jpg
├─ docs/                     analysis.md / report.md / short / long.md
├─ game.gif                  480×270 列表动画（165KB）
└─ poster.jpg                1280×720 封面（81KB）
```

## 2) 每条门禁的输出摘要（全绿）

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ | tests 23 · pass 23 · fail 0（sim 引擎 17 + 关卡配置 6） |
| `tools/selfplay.mjs` | ✅ | greedy level=24 / random level=1 / noinput level=1 |
| `fun-report.mjs` | ✅ **PASS** | 10 pass / 0 warn / 0 fail |
| `fun-audit.mjs` | ✅ **PASS** | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass=true | 0 console error / 0 失败请求 / 0 外部请求 |
| `i18n-check.mjs` | ✅ i18n OK | en/zh 各 50 key，0 missing 0 empty |
| `tutorial-check.mjs` | ✅ tutorial PASS | 3 步 / 可跳过 / 持久化 / 可重看 |
| `sdk-check.mjs` | ✅ pass=true | 降级/广告/埋点/存档/分享全过 |
| `audio-check.mjs` | ✅ allPass=true | 16/16（14 SFX + 2 loop）rms>0 peak<0.95 nan=0 |
| `vision-review.mjs` | ✅ **PASS** | readable 8.5 / silhouette 7.13 / style 8.75，critical 0 |

fun-report 关键指标：首输入 0s / 首胜 1s / 操作 2647/min / 空转 0% / 事件最大间隔 0s / 事件种类 11 / 推进率 100% / 死亡存在 67%。

## 3) 截图路径

玩法/验收截图（`tests/final/`，vision-review 评分用）：

- `tests/final/01-play.png` — 第 1 关实验室（温度计 → 冰水）
- `tests/final/02-play2.png` — 第 2 关（灯泡 + 影子）
- `tests/final/03-invert.png` — 第 4 关倒置（沙漏 + 旋转把手）
- `tests/final/04-boss.png` — 第 6 关 Boss（闹钟 / 毯子 / 助手）
- `tests/final/05-kitchen.png` — 第 7 关厨房（鸡蛋）
- `tests/final/06-garden.png` — 第 13 关花园（水壶 → 花）
- `tests/final/07-space.png` — 第 19 关太空（保护罩 / 发射 / 火箭）
- `tests/final/08-mobile.png` — 移动端 844×390 玩法
- `tests/final/tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png` — 引导三态

浏览器验收过程截图（`tests/artifacts/`）：`v02-title-zh.png`（中文标题）/ `v03-tutorial.png` / `v04-solved.png`（结算卡）/ `v05-play.png` / `v06-paused.png` / `v07-complete.png` / `v08-mobile-play.png`。

## 4) 未做项

- 不做联网/在线排行榜（spec 只要求「本地最佳时间榜」，已用 `bestTimes` 存档实现）。
- 不做皮肤商店 / 内购 / 每日任务（design.json `antiScope`）。
- 不做设备真实 `deviceorientation` 倒置：统一用「拖旋转把手」代替，桌面/触屏一致可玩（spec 明确此降级）。
- 不做 `ja/ko/ar/ru`：只暴露完整翻译的 en/zh（i18n 铁律，其他语言整块不暴露）。

## 5) 最不满意的一处

Boss 多步关的「组合」表现偏弱：头+帽装到身体、三颗星进槽这类「多步」本质上是**按序拖拽到目标**（物体吸附到目标中心），视觉上更像连续拖放，而不是真正的「组合成新物件」。引擎层面我有 `ls.placed` 记录了「谁进了谁」，但渲染只做了「吸附 + 缩小」，没有做一个「组装完成的新物体」画面。如果再做一轮，我会给 Boss 关加一个 `composite` 渲染态（例如组装出稻草人后原地画出一个完整的稻草人，乌鸦看到后飞走），让多步 Boss 的「收」更有仪式感。

---

*门禁均在本机自跑，输出见上；未 git commit、未起常驻服务器、未触碰其他游戏目录。*
