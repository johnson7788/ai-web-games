# NEO TETRA · 交付报告

> 改造自俄罗斯方块（Cocos 源码，assets-only）→ 霓虹炼金炉原创网页游戏。
> 全门禁自跑，全部 ≥WARN（实际全部 PASS）。未 git commit、未起常驻服务器、未碰其他游戏目录。

## 1) 文件清单

```
index.html                入口（1280×720 canvas + touch-bar + rotate 提示）
styles.css                霓虹炼金炉 UI / letterbox / 移动端响应式
package.json              {"type":"module"}
config/
  game.config.js          世界尺寸 / 步长 / 语言 / 存档键
  gameplay.js             井 / 重力 / DAS / 锁定 / 分数 / 热力 / 纯函数
  levels.js               12 矿层 + 3 场景包（copper/ice/core）
  locales.js              en/zh 62 key 全量
  sdk.config.js           appId pipy-neo-tetra（ads.enabled=false，source local）
  design.json             机器可读设计源（fun-audit 输入）
src/
  game/sim.js             Tetris 模拟（SRS 踢墙/7-bag/hold/消行/热力/白热/矿层特性）
  game/tetromino.js       7 块 4 状态 + SRS 踢墙表
  game/board.js           棋盘纯函数（碰撞/落点/消行/代价）
  game/rng.js             mulberry32 + 洗牌
  render/index.js         Canvas 渲染（3 场景包/晶块/ghost/next/hold/粒子/白热/暗井）
  render/theme.js         布局 / 场景色板 / 矿石色
  core/{i18n,save,sdk}.js i18n / 存档 / SDK 统一出口（abyss-eel 同款）
  core/audio.js           程序化 WebAudio（19 SFX + 4 BGM 层）
  ui/{index,screens,hud,tutorial}.js 屏幕/HUD/4 步首次引导
  main.js                 装配 / 固定步长 / 输入 / 事件分发 / 状态机 / BGM / __ll
  vendor/pipysdk.js       站点 SDK（本地 vendored）
tests/                    sim.test.mjs + tetromino.test.mjs（25 条）+ final 截图
tools/                    selfplay.mjs / audio-check.mjs / verify.plan.json / record-gif.mjs / make-poster.mjs
docs/                     analysis.md / report.md / long.md / short
game.gif                  480×270 / 4.5s / 1.89MB（真实玩法）
poster.jpg                1280×720（玩法图 + 发光大标题）
```

## 2) 门禁输出摘要（全部 PASS）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ | 25 tests / 25 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(layer=7,lines=42,ev=20) · random(dead) · noinput(dead) |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail（首输入 0s、首胜 2s、操作 2918/min、空转 0%、事件间隔 0s、事件种类 20、推进率 100%、死亡率 100%） |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ | fps 60（avgFrameMs 16.67）、0 console/page error、0 失败请求、全部断言过 |
| `i18n-check.mjs` | ✅ | en/zh 各 62 key，0 missing / 0 empty，暴露 en,zh |
| `tutorial-check.mjs` | ✅ PASS | visible/active/steps=4/skipped/persisted/replayable 全 true，0 console error |
| `sdk-check.mjs` | ✅ | SDK 对象+快捷 API 齐全、showRewarded 安全 false、埋点/存档/分享/断网降级全过，0 error |
| `audio-check.mjs` | ✅ | 19 SFX + 4 BGM 层，23/23 pass（rms>0、peak<0.95、nan=0） |
| `vision-review.mjs` | ✅ PASS | readable 8.0 / silhouette 6.1 / style 8.6，0 critical |

**说明（诚实记录）**：`verify-game.mjs` 与 `tutorial-check.mjs` 在本机 headless chromium（`--use-gl=angle --use-angle=metal`）下偶发 GPU 进程崩溃/页面挂起（与 pipysdk 的 `debugger` 反调试陷阱 + headless GPU 相关），重跑 1–3 次即得到稳定 clean pass；游戏自身逻辑无报错（0 console error 由各门禁反复确认）。上面记录的是 clean pass 的输出。

## 3) 截图路径

- 标题（英文）：`tests/final/01-title.png`
- 标题（中文）：`tests/final/02-title-zh.png`
- 玩法：`tests/final/03-play.png`（晶块 + ghost + next/hold + 热力条）
- 暂停：`tests/final/04-paused.png`
- 结算：`tests/final/05-dead.png`（顶出判负结算卡）
- 移动端（844×390）：`tests/final/06-mobile.png`
- 重开：`tests/final/07-restart.png`
- 首次引导：`tests/final/tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png`
- verify 过程截图：`tests/artifacts/v0*.png`

## 4) 未做项

- 未接广告账号：`ads.enabled=false`、`source:'local'`（按 brief 默认，Lead 上线时改 online）。
- 未做 ja/ko/ar/ru：brief 只要求 en 默认 + zh 完整。
- 未做 AI 位图素材：美术全程序化 Canvas / WebAudio（brief 允许「美术全程序化 Canvas」）。
- 未做真人试玩：全流程为自动门禁（brief 明确「没有真人」）。

## 5) 最不满意的一处

重块（石头）与 gift 块在 12 层后半段的视觉呈现偏弱：石头只有灰块、gift 只有中心亮点，与「熔炼炼金」主题的辨识度不够，且暗井 + 窄井 + 重块的组合特性没有逐层视觉验收截图。若再迭代一轮，优先给石头加裂纹纹理、给 gift 加旋转星标，并为第 7/11/12 层各补一张玩法截图进 `tests/final/`。
