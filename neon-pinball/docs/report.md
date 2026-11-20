# NEON PINBALL · 交付报告

> 改造自 `king-of-pinball-creator`（Cocos Creator）。玩法规则 1:1 还原弹珠物理 / 多球 / 掉落判负 / 逐台推进；角色/场景/音乐全原创为霓虹赛博弹球台。全部只写 `games/neon-pinball/`，未 commit。

## 1. 文件清单

```
games/neon-pinball/
├─ index.html  styles.css  package.json  .gitignore
├─ game.gif（480×270 / 4.54s / 556KB）  poster.jpg（1280×720）
├─ config/
│  ├─ game.config.js  gameplay.js  tables.js  design.json  locales.js  sdk.config.js
├─ src/
│  ├─ main.js
│  ├─ core/  i18n.js  save.js  sdk.js  audio.js
│  ├─ game/  rng.js  physics.js  table.js  sim.js
│  ├─ render/  index.js  theme.js
│  ├─ ui/  index.js  screens.js  hud.js  tutorial.js
│  └─ vendor/  pipysdk.js
├─ tests/  physics.test.mjs  sim.test.mjs
├─ tools/  selfplay.mjs  audio-check.mjs  verify.plan.json  record-gif.mjs  poster.mjs
├─ tests/final/  01-title 02-play 03-superconduct 04-paused 05-mobile 06-title-zh 07-dead + 各 report.json
└─ docs/  analysis.md  report.md  short.txt  long.md
```

## 2. 全套门禁输出摘要（全绿）

| 门禁 | 结果 | 关键观测 |
| --- | --- | --- |
| `node --test` | ✅ 28 pass / 0 fail | 圆-线段/圆-圆碰撞、能量衰减、反弹角、推杆发射、挡板、bumper/目标/超导灯、掉球判负、game over、过关推进、黑洞回球、移动目标、顶环充能 |
| `node tools/selfplay.mjs` | ✅ 3 策略 | greedy(machine=12,score=49000) / random(machine=1,dead=1) / noinput(machine=1,dead=1) |
| `fun-report.mjs` | ✅ PASS（10 pass/0 warn/0 fail） | 首输入 0s、首胜 1s、空转 0%、事件最大间隔 1s、推进率 100%、死亡存在 67% |
| `fun-audit.mjs` | ✅ PASS 100/100（26 pass） | 3 动词带代价、8 个前 3 分钟决定、12 台各带新元素、10 升级（rule 60%）、4 重玩钩子 |
| `verify-game.mjs` | ✅ PASS（桌面 13 断言 + 移动端 2） | 0 console error / 0 失败请求；标题/中英切换/开局/引导/发射/超导/暂停/判负/结算/重开全过 |
| `i18n-check.mjs` | ✅ OK | en 39 / zh 39，0 missing 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 4 步（launch/bumper/flipper/super）可见/可跳/持久/可重看 |
| `sdk-check.mjs` | ✅ PASS | SDK 对象/快捷 API 齐全、showRewarded 安全、埋点/存档/分享出口、断网降级、0 error |
| `tools/audio-check.mjs` | ✅ 21/21 PASS | 20 SFX + 1 BGM 循环，RMS>0/peak<0.95/无 NaN；BGM 程序化 8s 无缝循环 |
| `vision-review.mjs` | ✅ PASS | readable 8.6 / silhouette 6.7 / style 9.0；goal_visible 全 Y、无 HUD 遮挡、无文字裁切、移动安全 |

## 3. 截图路径（tests/final/）

- 标题：`01-title.png`、`06-title-zh.png`
- 玩法：`02-play.png`（首次引导 + 台面）
- 特殊状态：`03-superconduct.png`（超导态蓝白 + 带电球）
- 暂停/结算：`04-paused.png`、`07-dead.png`
- 移动端：`05-mobile.png`（844×390）

## 4. 未做项

- 未接广告账号：`sdk.config.js` 的 `ads.enabled` 保持 `false`（平台账号由 Lead 接入时再开）。
- 未做 `ja/ko/ar/ru`：只暴露 en/zh（整块不暴露半成品，i18n-check 通过）。
- 未做联网排行榜（原作的 FBInstant 排行榜在反范围内，见 `config/design.json` antiScope）。
- 未跑 `asset-check.mjs`：本作零素材文件（全程序化 Canvas + WebAudio 合成），无 `assets/` 目录，故不适用。

## 5. 最不满意的一处

**挡板救球手感**。为了在「纯逻辑 + 无头 bot」里稳定表达「按住挡板 = 击球」，挡板碰撞用了固定「向上台面」的冲量方向（`src/game/sim.js` 的 flipper 碰撞段），而不是严格按挡板当前角度的表面速度积分。这让游戏手感偏「arcade 宽容」——球更容易被救回，代价是少了真实 pinball 那种「翻早了打空、翻晚了掉球」的精细时机感。已通过「两尖中央留 34px 漏球缝 + 两侧 outlane 掉球缝」补回掉球风险，但挡板击球的物理真实性仍是本作最弱的一环，后续可改成「表面速度 + 角速度严格积分 + 接触点摩擦」。
