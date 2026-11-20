# RING CYCLE · 交付报告

> 规格：`docs/remake-all/games/spec-ring-cycle.md`（改造自 七彩蹦蹦 / ColorUp）
> 铁律：玩法 1:1 还原 + 角色/场景/音乐全原创；只写 `games/ring-cycle/`。

## 1) 文件清单

```
games/ring-cycle/
├─ index.html  styles.css  package.json  .gitignore  README.md
├─ game.gif            (1.03 MB · 480×270 · 4.5s)
├─ poster.jpg          (55 KB · 1280×720)
├─ SEO.txt
├─ config/
│  ├─ design.json  game.config.js  gameplay.js  levels.js  locales.js  sdk.config.js
├─ src/
│  ├─ main.js
│  ├─ core/    i18n.js  save.js  audio.js  sdk.js
│  ├─ game/    sim.js  spawner.js  rng.js
│  ├─ render/  index.js  theme.js  scene.js  rings.js  particles.js
│  ├─ ui/      index.js  screens.js  hud.js  tutorial.js
│  └─ vendor/  pipysdk.js
├─ tests/     sim.test.mjs  spawner.test.mjs  rng.test.mjs  tutorial.test.mjs
│             final/{01-title…07-mobile.png, vision-review.json/.md, sdk-report.json, tutorial-report.json}
├─ tools/     selfplay.mjs  audio-check.mjs  screenshots.mjs  record-gif.mjs  poster.mjs  verify.plan.json
│             fun/{autoplay.json, design-audit.*, fun-report.json, report.md}
└─ docs/      analysis.md  report.md  short.md  long.md
```

## 2) 每条门禁的输出摘要（全绿 / ≥WARN）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 28 pass / 0 fail（sim·spawner·rng·tutorial 纯逻辑） |
| `node tools/selfplay.mjs` | ✅ | greedy band=12 score=94 dead dur=87.7s；random dead 3.1s；noinput dead 8.3s |
| `fun-audit` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `fun-report` | ✅ PASS | 10 pass / 0 warn / 0 fail（首输入 0s、首胜 1s、空转 16%、事件间隔 1s、事件 9 种、推进 100%、死亡 100%） |
| `verify-game` | ✅ PASS | 桌面 18 步 + 移动端 4 步全过，0 console/page error、0 失败请求 |
| `i18n-check` | ✅ OK | en 52 / zh 52，missing 0 / empty 0，暴露 en+zh |
| `tutorial-check` | ✅ PASS | 3 步（steer/clear/chain）可见/可跳过/刷新不重复/可重看 |
| `sdk-check` | ✅ PASS | SDK 存在 + 快捷 API 齐全 + 降级可玩 + 0 error |
| `tools/audio-check` | ✅ PASS | 16/16（13 SFX + 3 BGM 层）rms>0 peak<0.95 nan=0 |
| `vision-review` | ✅ WARN | readable 7.7 / silhouette 6.4 / style 8.4（7 张，无 critical） |

## 3) 截图路径

- 标题：`tests/final/01-title.png`
- 玩法（果味车间）：`tests/final/02-play.png`、`tests/final/03-fruity.png`（带 3 移动环）
- 玩法（薄荷库）：`tests/final/04-mint.png`（带 5）
- 玩法（夜光仓）：`tests/final/05-glow.png`（带 9）
- 结算：`tests/final/06-dead.png`
- 移动端（844×390）：`tests/final/07-mobile.png`
- 验收过程图：`tests/artifacts/v01-title.png … v08-mobile-play.png`（verify-game 产出）

## 4) 未做项

- 上线上传由 Lead 负责（`upload_games`），本单不发布。
- G6.5 讲解视频（YouTube/X）不在本单范围。
- 美术按执行单「全程序化 Canvas」落地，未走 AI 出图（本 remake 铁律不引外部素材）。
- 存档只做 bestScore 与设置持久化；未做跨局 meta 成长（反范围约定）。

## 5) 最不满意的一处

HUD 顶部「Your color + 5 个同色链圆点」对视觉模型产生了「语义不明」的误读（vision-review 在 3 张图上都提到了「5 个小圆点含义不清」）。同色链进度是彩虹糖雨的关键前置，但当前只有圆点、没有文字或图例说明。若再迭代，会在 5 圆点旁加一行「×5 = rainbow」的迷你图例，把这一处做成一眼可读。
