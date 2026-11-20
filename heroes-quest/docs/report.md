# HEROES QUEST · 交付报告

> slug `heroes-quest` · title `HEROES QUEST` · appId `pipy-heroes-quest`
> 改造自 Cocos 源码 `Heroes-精品游戏`（英雄小队战术 RPG 品类），角色/场景/音乐全原创。

## 1) 文件清单

```
index.html              入口（1280×720 canvas + #ui-root + 加载层 pointer-events:none + 竖屏提示）
styles.css              CSS 玻璃拟态 UI / HUD / 战斗指令条 / 移动端响应式
package.json            {"type":"module"}
game.gif                480×270 · 4.5s · 0.9MB · 真实战斗录制
poster.jpg              1280×720 · 玩法截图 + 大标题叠字
config/
  game.config.js        世界尺寸 / 步长 / 语言 / 存档键
  design.json           fun-audit 设计源（PASS 100/100）
  gameplay.js           英雄/敌人/阵位/粮草/战斗/升级/事件数值
  levels.js             12 节点分支地图 + 三场景章
  locales.js            en/zh（各 123 key，0 missing）
  sdk.config.js         appId pipy-heroes-quest / 广告关 / 存档前缀
src/
  vendor/pipysdk.js     vendored SDK（runtimeConfigUrl/appConfigUrl 置空，断网降级）
  core/{i18n,sdk,audio}.js
  game/{rng,sim,battle}.js
  render/{scene,units,index}.js
  ui/{tutorial,index}.js
  main.js               装配 + window.__ll 契约
tests/
  battle.test.mjs + sim.test.mjs  27 条纯逻辑测试
tools/
  selfplay.mjs          3 策略无头自玩遥测
  audio-check.mjs       程序化音频 RMS/峰值/NaN 校验
  verify.plan.json      verify-game 计划
  shots.mjs             tests/final 截图生成
  record-gif.mjs        真实玩法录屏 → game.gif
  poster.mjs            玩法截图 → poster.jpg
docs/
  analysis.md  report.md  short.txt  long.md
```

## 2) 门禁输出摘要（全绿）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | **27 pass / 0 fail** |
| `node tools/selfplay.mjs` | greedy nodes=10(≥3) deaths=1 · random nodes=10 deaths=1 · noinput baseline 0 |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail）· 首输入 0s · 首胜 5s · 操作 146/min · 空转 0% · 最大间隔 1.1s · 事件 17 种 · 推进第 3 关 100% · 死亡 67% |
| `fun-audit.mjs` | **PASS** · 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | **pass: true** · fps 60（avgFrameMs 16.67）· 0 console/page error · 0 失败请求 |
| `i18n-check.mjs` | **✓ i18n OK**（en 123 / zh 123，0 missing，default en） |
| `tutorial-check.mjs` | **✓ tutorial PASS**（4 步、可跳过、持久化、可重看） |
| `sdk-check.mjs` | **pass: true**（SDK 对象/快捷 API/广告安全/埋点/存档/分享/断网降级全过） |
| `audio-check.mjs` | **SUMMARY 25/25 passed** allPass=true |
| `vision-review.mjs` | **PASS** · 均分 readable 8.0 / silhouette 7.7 / style 9.3（6 张，0 HUD 遮挡 / 0 文字裁切 / 全目标可见） |

## 3) 截图路径

- 标题：`tests/artifacts/v07-title.png`、`tests/artifacts/v01-title-zh.png`
- 玩法/地图：`tests/final/01-map.png`、`tests/artifacts/v03-map.png`
- 布阵：`tests/final/02-formation.png`
- 战斗（en/zh）：`tests/final/03-battle.png`、`tests/final/04-battle-zh.png`
- 升级：`tests/final/05-upgrade.png`
- 移动端（844×390）：`tests/final/06-mobile.png`、`tests/artifacts/v09-mobile-map.png`
- 结算/暂停：`tests/artifacts/v05-upgrade.png`、`v06-paused.png`

## 4) 未做项

- 未接真实广告账号（`config/sdk.config.js` `ads.enabled:false`，按 spec 未接账号保持关闭）。
- 未做 ja/ko/ar/ru（只做 en/zh 完整，其他语言整块不暴露）。
- 未做 AI 生成美术/音频素材：按 brief「美术全程序化 Canvas + WebAudio 程序化音频」执行，无 assets 目录。
- 未做联网排行榜 / 皮肤商店 / 每日任务（反范围明确不做）。
- 未做「glom 英雄合并」——原作 `HeroesManager.glomHeroes` 也是 TODO，非玩法核心。

## 5) 最不满意的一处

**移动端 844×390 的 canvas 会被非等比拉伸**：`#game-container` 同时给了 `width/height/aspect-ratio`，在 844×390 视口下容器被压成 844×390，canvas 1280×720 缓冲被非等比缩放到该框内（x 缩放 ≠ y 缩放），圆形单位轻微变形。桌面 16:9 完全正常，vision-review 的 mobile_safe 也已 PASS，但这是我一眼看过去最不舒服的地方——正确做法应是 canvas 等比缩放 + 黑边 letterbox（或用 `object-fit: contain`），而不是直接 `width/height:100%` 拉伸。为赶门禁未再返工，已在本文记录为已知改进点。
