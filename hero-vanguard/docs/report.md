# HERO VANGUARD · 交付报告

> 改造自「英雄大战外星人」（源码分析见 [analysis.md](analysis.md)）。玩法规则 1:1 还原 P0 骨架（英雄自动攻击 / 技能 CD / 敌波推进 / 基地血 / 击杀得金币升级 / 波次 Boss / 败=基地破），角色/场景/音乐全原创。

## 1. 文件清单

```
index.html · styles.css · package.json · README.md · SEO.txt
poster.jpg (1280×720) · game.gif (480×270 / 4.5s / 355KB)
config/ design.json · game.config.js · gameplay.js · levels.js · locales.js · sdk.config.js
src/core/ i18n.js · save.js · sdk.js · audio.js
src/game/ sim.js · rng.js
src/render/ index.js · theme.js · particles.js
src/ui/ index.js · screens.js · hud.js · tutorial.js
src/vendor/ pipysdk.js
tests/ sim.test.mjs · final/*（验收截图 + 报告）
tools/ selfplay.mjs · verify.plan.json · audio-check.mjs · record-gif.mjs · make-poster.mjs
docs/ analysis.md · report.md · short.txt · long.md
```

## 2. 门禁输出摘要（全部 ≥WARN / 全绿）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ **20 pass / 0 fail** |
| bot 遥测 | `node tools/selfplay.mjs` | ✅ greedy 通关 wave12 / random 死于 wave8 / noinput 死于 wave1 |
| Fun Gate | `fun-report.mjs --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| 设计审计 | `fun-audit.mjs --root .` | ✅ **PASS** 100/100（26 pass） |
| 浏览器验收 | `verify-game.mjs --plan tools/verify.plan.json --out tests/final` | ✅ **pass=true**，0 console error / 0 失败请求 |
| 语言完整性 | `i18n-check.mjs --root .` | ✅ **i18n OK**（en=zh=67 keys，0 missing / 0 empty） |
| 首次引导 | `tutorial-check.mjs --out tests/artifacts` | ✅ **tutorial PASS**（3 步 move/kill/resonance，可跳过/重看/持久化） |
| SDK 接入 | `sdk-check.mjs --out tests/final` | ✅ **pass=true**（SDK 就绪/降级/广告/埋点/存档/分享全过） |
| 音频 | `node tools/audio-check.mjs` | ✅ **21/21 passed**（RMS>0 / peak<0.95 / 无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | ✅ **PASS**（readable 8.3 / silhouette 6.9 / style 8.5） |

### fun-report 关键指标

首次输入 0s（≤10）· 输入延迟 90ms（≤120）· 首胜 2s（≤60）· 成功率 100% · 操作 3035/min（≥60）· 空转 0%（≤15%）· 事件最大间隔 1.0s（≤3）· 事件种类 18（≥8）· 推进到第 3 波 100%（≥60）· 死亡存在 67%（≥50%）。

### bot 三策略

| run | 策略 | 时长 | 首胜 | 波次 | 死亡 |
| --- | --- | --- | --- | --- | --- |
| greedy-123 | greedy | 240s | 2s | 12（通关） | 0 |
| random-456 | random | 162s | 4s | 8 | 1 |
| noinput-789 | noinput | 15s | 7s | 1 | 1 |

## 3. 截图路径（tests/final/）

- `01-title.png` 标题屏（默认英文）
- `02-title-zh.png` 中文标题
- `03-tutorial.png` 首次交互引导
- `04-play.png` 战斗（HUD 不透明条 + 双子英雄 + 敌波 + 基地）
- `05-paused.png` 暂停
- `06-dead.png` 基地破防结算
- `07-restart.png` R 键重新部署
- `08-mobile-play.png` 移动端 844×390（摇杆 + 技能按钮）

## 4. 未做项

- 未接广告账号（`config/sdk.config.js` `ads.enabled=false`），广告 UI 整体不出现——符合「未接账号保持关闭」。
- `source:'local'` 使用 vendored pipysdk；上线前由 Lead 改为 `'online'`。
- 未做 ja/ko/ar/ru（按 playbook 只暴露 en/zh 完整语言，其余整块不暴露）。
- 未做联网/排行榜/皮肤商店/每日任务/剧情（见 design.json antiScope）。
- 未起常驻服务器；未 git commit；未改动其他游戏目录与 `skills/`、仓库根文件。

## 5. 最不满意的一处

**随机策略（random）在早期调参时曾持续通关**，暴露了「共鸣斩/换位是无需瞄准的 AoE，乱按也能打」的问题——为此把护盾充能改成站桩、换位伤害/冷却下调、重甲/Boss 大幅加厚，并把 AI 协同英雄攻速压到主控的 1/1.7，最终 random 死于第 8 波、greedy 通关。但这套「主动/被动差距」主要靠数值拉开，而不是更本质的**技能需要时机/走位**，下一版最想把换位共鸣改成有方向性的路径斩（需要预判敌人行进路线），让「乱按」真的打不中。
