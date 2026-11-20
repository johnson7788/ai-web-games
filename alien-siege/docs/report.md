# ALIEN SIEGE — 交付报告

> 改造自 `3d枪战-creator3d`（Cocos Creator 3D FPS）→ 原创伪 3D 光线投射网页游戏。
> 规格：`docs/remake-all/games/spec-alien-siege.md` · 执行单：`docs/remake-all/REBUILD-BRIEF.md`（v2）

## 1) 文件清单

```
games/alien-siege/
├─ index.html / styles.css        入口（1280×720 letterbox + 竖屏提示 + 加载层不拦截点击）
├─ config/
│  ├─ game.config.js              世界尺寸 / 步长 / 语言
│  ├─ gameplay.js                 玩家/武器/敌型/波次/命中 全部数值
│  ├─ levels.js                   12 波 + 3 场景包
│  ├─ locales.js                  en + zh（48 key 完全一致）
│  ├─ sdk.config.js               appId=pipy-alien-siege
│  └─ design.json                 机器可读设计源（fun-audit 输入）
├─ src/
│  ├─ core/                       i18n.js / audio.js（程序化合成）/ sdk.js（唯一出口）
│  ├─ game/                       sim.js（纯逻辑）/ map.js（DDA 光线投射）/ rng.js
│  ├─ render/                     index.js（raycasting）/ theme.js（三场景色板）
│  ├─ ui/                         screens / hud / tutorial / index
│  ├─ vendor/pipysdk.js           vendored（runtimeConfigUrl/appConfigUrl 已置空）
│  └─ main.js                     装配 + 固定步长 + window.__ll 契约 + boot 守卫
├─ tests/                         map.test.mjs + sim.test.mjs（22 条纯逻辑）
├─ tools/                         selfplay / audio-check / verify.plan / record-gif / make-poster
├─ docs/                          analysis.md / short.md / long.md / report.md
├─ poster.jpg                     1280×720 封面
└─ game.gif                       480×270 玩法循环（≤2MB）
```

## 2) 门禁输出摘要（全部 PASS/OK）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | **22 pass / 0 fail** |
| bot 遥测 | `node tools/selfplay.mjs` | greedy wave=4 / random·noinput 各死 1 次 |
| Fun Gate | `fun-report.mjs --root .` | **PASS**（10 pass / 0 warn / 0 fail） |
| 设计审计 | `fun-audit.mjs --root .` | **PASS**（100/100，26 pass） |
| 浏览器验收 | `verify-game.mjs --plan tools/verify.plan.json --out tests/final` | **pass=true，60fps，0 error / 0 404 / 0 外部请求** |
| i18n | `i18n-check.mjs --root .` | **✓ i18n OK**（en/zh 各 48 key，0 missing/empty） |
| 首次引导 | `tutorial-check.mjs --root . --out tests/artifacts` | **✓ tutorial PASS**（4 步 / 可跳 / 可重看 / 持久化） |
| SDK | `sdk-check.mjs --root . --out tests/final` | **pass=true**（API 齐 / 降级 / 0 error / 0 失败请求） |
| 音频 | `node tools/audio-check.mjs` | **26/26 passed**（SFX 23 + BGM 3 层，RMS>0 峰值<0.95） |
| 视觉评审 | `vision-review.mjs --root .` | **PASS**（readable 8.3 / silhouette 7.0 / style 8.9） |

关键遥测（fun-report）：首次输入 0s、输入延迟 90ms、首胜 3s、空转 0%、事件最大间隔 1.0s、事件种类 12、推进率 100%、死亡存在性 67%。

## 3) 截图路径

- 标题：`tests/final/01-title.png`
- 玩法（镭射标记）：`tests/final/02-marker.png`
- 玩法（护盾背包）：`tests/final/03-shield.png`
- 玩法（Boss 母巢）：`tests/final/04-boss.png`
- 结算（死亡）：`tests/final/05-dead.png`
- 重开：`tests/final/06-restart.png`
- 移动端（844×390 触屏）：`tests/final/07-mobile.png`
- 封面：`poster.jpg` · 循环动画：`game.gif`

## 4) 未做项

- 未接真实广告账号（`ads.enabled=false`，按规格未接账号保持关闭）。
- 未接入 AI 生成图片素材——本作美术全部程序化（伪 3D 光线投射 + CSS UI），符合「美术全程序化 Canvas」约束。
- 未做 ja/ko/ar/ru（按规格仅 en+zh 完整暴露）。
- 未做每日任务 / 排行榜 / 剧情（反范围清单内）。
- 未跑 `asset-check.mjs`（无 `assets/` 图片素材目录，仅有程序化渲染，无外链无 404）。

## 5) 最不满意的一处

**敌人 billboard 剪影仍偏「方块感」。** 视觉模型在 `02-marker` 与 `03-shield` 里反复提到「目标外圈红橙渐变与背景对比不足」「枪口仅底部微亮条」，说明程序化敌人的轮廓辨识度离「一眼认出是异形」还有距离。当前靠「头冠 + 发光核心眼 + 暗色描边」勉强把 silhouette 拉到 7.0（门槛 6），但更理想的做法是给每类敌人做 2–3 层分层部件（尖刺 / 触手 / 节肢）驱动出非矩形剪影。受时间约束没有做，是本作最遗憾的视觉短板。
