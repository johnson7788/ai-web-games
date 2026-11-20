# DICE CASCADE · 交付报告

> slug `dice-cascade` · 改造自 `弹球 cocoscreator 3.0`（源码分析见 `docs/analysis.md`）
> 规格：`docs/remake-all/games/spec-dice-cascade.md` · 共享执行单 v2 严格照做

## 1) 文件清单

```
games/dice-cascade/
├─ index.html / styles.css / package.json
├─ poster.jpg（1280×720 海报）· game.gif（480×270 / 4.5s / 553KB）
├─ SEO.txt · docs/short.txt（≤160 字符）· docs/long.md（英+中操作说明）
├─ config/
│  ├─ design.json（G0.5 设计源，fun-audit PASS）
│  ├─ game.config.js（世界/步长/语言/存档键）
│  ├─ gameplay.js（骰子/押注/弹珠板/回合节奏/符文成长，纯数据）
│  ├─ levels.js（12 段推进结构：目标分递增 + 多骰/诅咒/幸运轮轮换）
│  ├─ locales.js（en/zh 完整，45 key 全对齐）
│  └─ sdk.config.js（appId: pipy-dice-cascade，ads.enabled=false）
├─ src/
│  ├─ core/  i18n.js · save.js · sdk.js（统一 SDK 出口）· audio.js（WebAudio 程序化）
│  ├─ game/  rng.js（mulberry32）· board.js（Galton 板确定性落桶）· sim.js（纯逻辑核心）
│  ├─ render/ index.js（Canvas 程序化神殿/钉阵/落珠/粒子）· theme.js（石/翡翠/熔岩三套色板）
│  ├─ ui/    index.js · screens.js · hud.js · tutorial.js
│  ├─ vendor/pipysdk.js（本地 vendored，runtimeConfigUrl/appConfigUrl 已置空）
│  └─ main.js（固定步长/状态机/事件分发/__ll 契约/boot 守卫）
├─ tests/ sim.test.mjs（20 条纯逻辑测试）· final/（6 张玩法验收截图）
├─ tools/ verify.plan.json · selfplay.mjs · audio-check.mjs · shots.mjs · poster.mjs · record-gif.mjs
└─ docs/ analysis.md · report.md · short.txt · long.md
```

体积：zip 相关文件（剔除 `tests/artifacts/`）约 **1.64MB**，≤3MB；BGM 与 SFX 全部 WebAudio 程序化合成，无打包音频文件。

## 2) 门禁输出摘要（全部 ≥WARN）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 20 tests / 20 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(stage=4,dead=1) random(stage=4,dead=1) noinput(stage=4,dead=1) |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail（首胜 8s / 操作 54/min / 空转 9% / 推进率 100% / 死亡 100%） |
| `verify-game.mjs` | ✅ PASS | 0 error / 0 失败请求 / fps 60（avgFrameMs 16.66） |
| `i18n-check.mjs` | ✅ OK | en 45 / zh 45，missing 0，empty 0，exposed en,zh |
| `tutorial-check.mjs` | ✅ PASS | 3 步（bet/roll/clear）· 可跳过 · 持久化 · 可重看 |
| `sdk-check.mjs` | ✅ PASS | SDK 对象/API/广告降级/埋点/存档/分享/断网降级全过 |
| `tools/audio-check.mjs` | ✅ PASS | 12/12（11 SFX + 1 BGM loop），rms>0 && peak<0.95 && nan=0 |
| `vision-review.mjs` | ⚠️ WARN | readable 7.8 / silhouette 6.8 / style 9.0（目标可见/HUD 无遮挡/文字无裁切/移动安全全 Y） |

Fun Gate 遥测明细（`tools/fun/autoplay.json`，genre=puzzle）：greedy 推进到第 4 关、首胜 7.6s；random 与 noinput 同样推进到第 4 关并死亡（noinput 靠 6s 自动掷骰兜底推进，符合「无输入会自动推进」基线）。

## 3) 截图路径

标题 / 教程 / 暂停（`tests/artifacts/`）：`01-title.png`、`02-title-zh.png`、`03-tutorial.png`、`05-paused.png`、`06-title.png`

玩法（`tests/final/`，供 vision-review）：
- `01-play-stone.png` — 石殿（沙金）
- `02-play-jade.png` — 翡翠殿（青绿）
- `03-play-lava.png` — 熔岩殿（红黑）
- `04-triple.png` — 三连符文 signature（三骰同面金光）
- `05-play-zh.png` — 中文玩法

移动端（844×390）：`tests/final/06-mobile.png`、`tests/artifacts/07-mobile-play.png`

## 4) 未做项

- 未接广告账号（`sdk.config.js` 里 `ads.enabled=false`），符合平台策略；SDK 断网降级与广告安全返回 false 均已由 sdk-check 验证。
- 未做 ja/ko/ar/ru（按铁律「整语言完整才暴露」，只做 en/zh）。
- 未做联网/排行榜/皮肤商店/每日任务/剧情（见 `config/design.json` 的 `antiScope`）。
- 未用 AI 生成素材：本作美术全程序化 Canvas（三套神殿场景包）、BGM/SFX 全 WebAudio 程序化合成，符合 brief「零素材 / zip≤3MB / 不打包音频」约束。
- 未 git commit、未起常驻服务器、未触碰其他游戏目录。

## 5) 最不满意的一处

`vision-review` 停在了 **WARN**（readable 7.8 / silhouette 6.8，未到 PASS）。视觉模型反复指出顶部 HUD（SCORE / UNBANKED）与石柱装饰、钉阵点的视觉层级可再优化——虽然所有 critical 项（目标可见 / HUD 遮挡 / 文字裁切 / 移动安全）全过、均分也达到 ≥WARN 门槛，但离「一眼 PASS」还差一口气。后续若重开此作，优先把顶部 HUD 与装饰元素进一步拉开、给钉阵增加行级明暗区分，把 readable 推到 ≥8。
