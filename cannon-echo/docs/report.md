# CANNON ECHO — 交付报告

> 改造自 startwar 星战炮台（源码分析见 [analysis.md](analysis.md)）。玩法规则 1:1 还原（底部炮台瞄准 / 弹速飞行 / 盒子波次过场 / 命中得分 / 炮台等级），角色·场景·音乐全原创。
> 全套门禁自跑全绿（vision-review 为 WARN，见 §5）。

## 1) 文件清单

```
config/           game.config.js / gameplay.js / levels.js / locales.js / sdk.config.js / design.json
src/game/         sim.js（纯逻辑） / rng.js
src/render/       index.js / scene.js / theme.js / particles.js（三场景包 Canvas 程序化）
src/ui/           index.js / screens.js / hud.js / tutorial.js
src/core/         sdk.js / i18n.js / audio.js（WebAudio 程序化 BGM+SFX）
src/vendor/       pipysdk.js（vendored，appId=pipy-cannon-echo）
src/main.js       固定步长 60Hz 装配 / window.__ll 契约 / boot 竞态守卫
index.html / styles.css / package.json
tests/sim.test.mjs           21 条纯逻辑测试
tests/final/                 8 张验收截图 + tutorial/sdk/vision 报告
tools/            selfplay.mjs / verify.plan.json / audio-check.mjs / shots.mjs / record-gif.mjs / poster.mjs
docs/             analysis.md / report.md / short.md / long.md
game.gif / poster.jpg        上线物料
```

## 2) 门禁输出摘要（全部自跑）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ 21/21 pass |
| 设计审计 | `fun-audit.mjs --root .` | ✅ PASS 100/100（26 pass） |
| bot 遥测 | `fun-report.mjs --root .` | ✅ PASS（10 pass / 0 warn / 0 fail） |
| 浏览器验收 | `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ pass（0 error / 0 失败请求） |
| i18n | `i18n-check.mjs --root .` | ✅ OK（en/zh 各 75 key，0 missing） |
| 交互引导 | `tutorial-check.mjs --root .` | ✅ PASS（3 步，可跳过/可重看/持久化） |
| SDK | `sdk-check.mjs --root .` | ✅ pass（降级/广告/埋点/存档/分享全过） |
| 音频 | `tools/audio-check.mjs` | ✅ 19/19 passed（RMS>0、peak<0.95、无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | ⚠️ WARN（readable 7.9 / silhouette 6.9 / style 8.6，无 Critical） |

**bot 遥测要点**：greedy 推进到第 4 波（≥3 ✓）、首胜 2s、空转 0%、事件最大间隔 1s、事件种类 10、三策略 2/3 死亡（deathPresence 100%）。

**Fun Gate 结构**：3 动词各带代价且可组合；前 3 分钟 7 个决定；12 波每波新元素；10 项升级（规则型 60%）；4 个重玩钩子。

## 3) 截图路径

- 标题：`tests/final/01-title.png`、`tests/final/02-title-zh.png`
- 玩法：`tests/final/03-play.png`、`tests/final/04-combat.png`
- 回声 signature：`tests/final/05-echo.png`
- 升级三选一：`tests/final/06-upgrade.png`
- Boss：`tests/final/07-boss.png`
- 移动端（844×390）：`tests/final/08-mobile.png`

## 4) 未做项

- 未接广告账号（`sdk.config.js` 里 `ads.enabled=false`，广告 UI 不出现，`showRewarded` 安全返回 false）。
- 未做 ja/ko/ar/ru 语言（只暴露 en/zh，i18n-check 0 missing）。
- 未接在线 SDK（`source:'local'` 用 vendored 副本，上线前改 `'online'`）。
- 未做排行榜/每日挑战/皮肤商店（antiScope 内）。

## 5) 最不满意的一处

**视觉评审只有 WARN（readable 均分 7.9，差 0.1 到 PASS）。** 主要扣分点是 05-echo 截图（护盾箱单块悬浮、缺乏目标语义）与标题屏「Best score」文字对比度偏低。已把目标盒加大加亮、HUD 用不透明条、标题/玩法/升级/Boss/移动端均过 `goal_visible`，但回声截图仍被模型判为「目标语义弱」。若再迭代一轮，会把 05-echo 换成「护盾箱 + 反弹弹道箭头 + 命中火花」的三层视觉提示，并给 HUD 标签加更明确的可读性对比。
