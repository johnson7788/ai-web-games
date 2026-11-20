# PENTA CARDS · 交付报告

> 改造自 H5卡五星（湖北 3 人麻将联网房间），剥离联网做**单机 vs 2 AI**，原创「星象牌桌」主题 + 观星/换星区别点。
> 全部门禁自跑全绿。未 git commit、未起常驻服务器、未碰其他游戏目录。

## 1) 文件清单

```
config/            design.json / game.config.js / locales.js / rules.js / sdk.config.js
src/core/          i18n.js / sdk.js / audio.js（程序化 WebAudio）
src/game/          rng.js / tiles.js / hand.js（胡牌/向听/番数）/ sim.js（状态机 + AI）
src/render/        index.js（Canvas 牌桌 / 牌面 / 星阵连线 / 三场景包）
src/ui/            ui.js / tutorial.js
src/main.js        装配 / 固定步长 / 事件分发 / 状态机 / __ll 契约
src/vendor/        pipysdk.js（vendored，runtimeConfigUrl/appConfigUrl 置空）
styles.css         letterbox + #rotate + HUD/动作条响应式
index.html         title/pause/settings/round/session + HUD + 动作条
tests/             sim.test.mjs（20 条纯逻辑）
tools/             selfplay / audio-check / verify.plan.json / capture-final / record-gif / make-poster
docs/              analysis.md（源码侦察）/ short.txt / long.md / report.md
poster.jpg         game.gif         SEO.txt
```

## 2) 门禁输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 20 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ greedy(round=12, 胜8/负3, 首胜13.2s) · random(负9) · noinput(负7) |
| `fun-report --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail；空转 1%、事件种类 13、首胜 13s、推进率 100%） |
| `fun-audit --root .` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game --plan tools/verify.plan.json` | ✅ pass=true · 60fps · 0 console/page error · 0 失败请求 · 0 外部请求 |
| `i18n-check --root .` | ✅ en 74 key / zh 74 key · 0 missing · 0 empty |
| `tutorial-check --root .` | ✅ PASS（3 步 / 可跳过 / 持久化 / 可重看） |
| `sdk-check --root .` | ✅ pass=true（降级 / 广告关闭安全 / track / 存档 / 分享 / 断网可玩） |
| `node tools/audio-check.mjs` | ✅ 21/21 pass（18 SFX + 3 BGM loop，RMS>0 峰值<0.95 无 NaN） |
| `vision-review --root .` | ✅ **PASS**（readable 8.2 / silhouette 6.3 / style 8.5，无 critical） |

## 3) 截图路径

- `tests/final/01-title.png` — 英文标题屏
- `tests/final/02-title-zh.png` — 中文标题屏
- `tests/final/03-play.png` — 牌桌玩法（手牌 + 牌墙 + 对手弃牌）
- `tests/final/04-result.png` — 单局结算卡
- `tests/final/05-play2.png` — 第二局玩法
- `tests/final/06-mobile.png` — 移动端 844×390
- `poster.jpg`（1280×720 海报）/ `game.gif`（480×270 / 4.5s / 757KB，真实玩法自动对局）

## 4) 未做项

- 原作房规「明牌 / 漂钱 / 买马 / 换三张 / 荒庄查叫」未实现（记录于 `docs/analysis.md` §5）。
- 广告未接真实账号（`config/sdk.config.js` `ads.enabled=false`）。
- 反范围项：无排行榜 / 每日挑战 / 剧情 / 付费（见 `config/design.json` antiScope）。

## 5) 最不满意的一处

牌面目前只画「数字 + 花色角标 + 三元图形」，没有像真麻将那样按点数铺星宿图案（星 1-9 逐点递增、轨 1-9 逐轨递增）。好处是辨识快，坏处是「星象牌桌」的视觉记忆点偏弱，新手前几局要靠角标颜色分辨花色，眯眼（silhouette）也不如满点数牌面有区分度。若再加一轮美术，会优先把点数铺成程序化星阵，让「5」之外的每一张也有自己的星图。
