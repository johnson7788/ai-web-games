# CARD LORD · 交付报告

> 共享执行单 v2 · slug `card-lord` · 改造自 `斗地主-demo` + `联网斗地主`（源码分析见 `docs/analysis.md`）。
> 玩法规则 1:1 还原，赛博牌局皮肤/记牌器/加倍为原创。

## 1) 文件清单

```
index.html              入口（1280×720 letterbox + #rotate + 非拦截 #loading）
styles.css              赛博霓虹 UI（响应式 844×390 不遮挡、按钮 ≥44px）
game.gif                480×270 · 4.5s · 1.0MB（真实玩法录制）
poster.jpg              1280×720（玩法截图 + 叠标题/tagline）
config/
  game.config.js        世界/步长/语言/存档键
  gameplay.js           牌值/段位(12)/AI 参数/结算/加倍上限
  design.json           机器可读设计源（fun-audit PASS 100）
  locales.js            en + zh 完整（49 key 完全一致）
  sdk.config.js         appId pipy-card-lord / 广告关闭 / 埋点 / 存档 / 分享
src/
  vendor/pipysdk.js     vendored SDK（runtimeConfigUrl/appConfigUrl 置空，避免 ERR_ABORTED）
  core/i18n.js          en 默认 + zh 完整 + ?lang= + 持久化
  core/save.js          localStorage 安全降级存档
  core/sdk.js           广告/埋点/存档/分享统一出口（全降级）
  core/audio.js         程序化 WebAudio（16 SFX + 2 循环 BGM，无音频文件）
  game/cards.js         牌模型/洗牌(seed)/排序/点数
  game/rules.js         牌型判定 + 压牌（单/对/三/三带一/三带对/顺子/连对/飞机/四带二/炸弹/王炸）
  game/ai.js            贪心 AI（叫分评分 + 手牌拆解 + 同型最小压 + 队友配合，skill 0..1）
  game/engine.js        会话 + 单局（叫分→加倍→出牌→春天/反春天结算 + 记牌器）
  game/rng.js           mulberry32 可复现随机
  render/index.js       赛博牌桌 Canvas（发光牌背/炸弹红光震屏/软光晕桌）
  ui/index.js           标题/HUD/记牌器/动作条/暂停/结算
  ui/tutorial.js        4 步交互引导（叫分→选牌→出牌→首胜，可跳过/重看/持久化）
  main.js               装配 + window.__ll 契约 + boot 竞态守卫
tests/                  rules/engine/ai 纯逻辑测试（39 断言）
tools/                  selfplay / audio-check / verify.plan / record-gif / poster / make-screens
docs/                   analysis.md / short.md / long.md / report.md
```

## 2) 门禁输出摘要（全部自跑，退出码全 0）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ 39/39 | rules 31 + engine 5 + ai 3 |
| `node tools/selfplay.mjs` | ✅ | greedy 赢 3 局→tier4（deaths=1，firstWin=8.4s）；random/noinput 各死 1 |
| `fun-report --root .` | ✅ PASS | 10 pass / 0 warn / 0 fail；首胜 8s、推进 100%、死亡 100% |
| `fun-audit --root .` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game --plan tools/verify.plan.json` | ✅ | pass=true，0 console/page error，0 失败请求 |
| `i18n-check --root .` | ✅ | en/zh 各 49 key，0 missing 0 empty |
| `tutorial-check --root .` | ✅ PASS | visible/active/steps=4/skip/persist/replay 全 true |
| `sdk-check --root .` | ✅ | SDK 就绪、showRewarded 安全 false、埋点/存档/分享可用、断网降级可开 |
| `tools/audio-check.mjs` | ✅ | 18/18（16 SFX + 2 loop）rms>0 & peak<0.95 & nan=0 |
| `vision-review --root .` | ✅ WARN | 8 张 readable 7.4 / silhouette 6.3 / style 8.1，无 critical |

## 3) 截图路径（tests/final/）

标题/玩法/移动端：`01-bidding.png`（叫分）· `02-doubling.png`（加倍）· `03-playing.png` / `04-selected.png`（选牌出牌）· `05-after-play.png` / `06-late.png`（中后期）· `07-zh.png`（中文）· `08-result.png`（结算）· `09-mobile.png`（移动端 844×390）；引导三张 `tutorial-*.png`。

## 4) 未做项

- 不做联网 / 排行榜 / 皮肤商店 / 每日任务 / 剧情（反范围，见 design.json antiScope）。
- 广告未接账号：`sdk.config.js` 的 `ads.enabled=false`，`showRewarded` 安全返回 false（sdk-check 已验证）。
- 未做 AI 的完整「手数最小化」搜索（飞机带牌/四带二的领出候选只取最低解，够贪心 bot 稳定赢第 3 局）。

## 5) 最不满意的一处

**记牌器交互偏薄**：当前记牌器是只读计数条，玩家不能点它来筛选/高亮某个点数。原设计里它是差异化卖点，但受工期约束只做了「剩余张数 + 低牌高亮」，没有做成「点一下反查哪些牌还能压」。这是我下一轮最想补的规则型深度（也对应 design.json 里的 `bombWarning` 升级）。
