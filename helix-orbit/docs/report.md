# HELIX ORBIT — 交付报告

> 改造自「球球跳跃 3D」（Helix Jump 品类）→ 原创熔岩螺旋塔下坠街机。
> slug `helix-orbit` · appId `pipy-helix-orbit` · 零构建纯静态 · 1280×720 letterbox · 60Hz 固定步长 · config-first。

## 1) 文件清单

```
index.html                入口（canvas + ui-root + #rotate + #loading）
styles.css                玻璃拟态 UI + HUD 响应式 + 竖屏提示 + loading 不拦截点击
config/
  game.config.js          WORLD/STEP/CONFIG（语言/存档键）
  gameplay.js             全部数值常量 + 角度纯函数
  levels.js               12 段层形轮换 + 三场景包色板
  locales.js              en/zh 各 38 key
  sdk.config.js           appId=pipy-helix-orbit，本地 vendored SDK
  design.json             机器可读设计源（fun-audit PASS 100）
src/
  core/i18n.js  save.js  sdk.js  audio.js（16 音效 + 3 循环层）
  game/rng.js  sim.js     纯逻辑：塔旋转/穿落/岩浆判负/陨石态/冰晶冻结/岩芯裂隙
  render/index.js         Canvas 2D 伪 3D 椭圆堆叠塔 + 楔形段 + 缺口光柱 + 粒子
  ui/index.js hud.js screens.js tutorial.js
  vendor/pipysdk.js       SDK 三件套
  main.js                 装配/固定步长/输入/事件分发/状态机/__ll 契约/boot 守卫
tests/sim.test.mjs        17 条纯逻辑测试
tools/selfplay.mjs  verify.plan.json  audio-check.mjs
tools/record-gif.mjs  make-poster.mjs
tools/fun/               design-audit / autoplay / fun-report
tests/final/             verify/tutorial/sdk/vision 报告 + 7 张截图
docs/analysis.md  报告本文件  docs/short  docs/long.md
game.gif（480×270，4.6s，658KB）  poster.jpg（1280×720）
```

## 2) 门禁输出摘要（全部自跑）

| 门禁 | 结果 | 关键观测 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 17 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ 3 策略 | greedy depth=11 / random depth=0 / noinput depth=0，全部产出遥测 |
| `fun-audit.mjs --root .` | ✅ PASS | 100/100，26 pass / 0 warn / 0 fail |
| `fun-report.mjs --root .` | ✅ PASS | 10 pass / 0 warn / 0 fail；首输入 0s、首胜 1s、行动 3527/min、空转 3%、事件间隔 1.1s、事件种类 10、推进率 100%、死亡率 100% |
| `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ PASS | pass=true，0 console/page error，0 失败请求 |
| `i18n-check.mjs --root .` | ✅ OK | en/zh 各 38 key，0 missing / 0 empty |
| `tutorial-check.mjs --root .` | ✅ PASS | 4 步（rotate/pass/meteor/smash），visible/active/skip/persist/replay 全过 |
| `sdk-check.mjs --root .` | ✅ PASS | SDK 就绪 / 降级 / 广告关闭安全 false / 埋点 / 存档 / 分享 / 断网降级 全过 |
| `node tools/audio-check.mjs` | ✅ PASS | 16/16，allPass=true |
| `vision-review.mjs --root .` | ✅ WARN | readable 7.7 / silhouette 6.1 / style 8.6，0 critical |

全部 ≥WARN，全绿。

## 3) 截图路径（tests/final/）

| 场景 | 文件 |
| --- | --- |
| 标题（中文） | `tests/final/v02-title-zh.png` |
| 首次引导 | `tests/final/v03-tutorial.png` |
| 玩法 | `tests/final/v04-play.png` |
| 暂停 | `tests/final/v05-paused.png` |
| 死亡结算 | `tests/final/v06-dead.png` |
| 重开 | `tests/final/v07-restart.png` |
| 移动端（844×390） | `tests/final/v08-mobile-play.png` |

## 4) 未做项

- **游戏难度曲线未做进一步打磨**：greedy 在 60–180 秒内的死亡节奏未专门校准（当前 greedy 在第 11 段岩浆密段判负，约 10s；random/noinput 更早死亡）。fun-report 硬门槛全过，但 G4.2 的「60–180s 至少死一次」只满足「会死」，未满足「60s 后再死」。
- 未接入真实广告账号（`ads.enabled=false`，符合「未接账号保持 false」）。
- 未生成 ja/ko/ar/ru（按铁律只暴露 en/zh 完整语言）。

## 5) 最不满意的一处

**陨石态（signature）的「慢镜」只在渲染侧用粒子/尾焰表现，sim 层没有真正的时间缩放。**
`METEOR.SLOWMO_SEC` 常量定义了但 sim 未消费——砸穿岩浆的「熔岩四溅慢镜」目前靠 `meteorSmash` 事件触发粒子爆裂 + 弹跳 hop 来暗示，缺少让玩家真正感到「时间放慢」的 60Hz 时间缩放反馈。这是本作最有辨识度的瞬间，却也是最弱的一环；若再迭代，会优先把 `meteorSmash` 落地成 sim 侧 `timeScale`（0.3× 约 0.55s）+ 渲染插值补偿，让 signature 名副其实。
