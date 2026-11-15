# RAGDOLL ARCHERS 3D · 定点修复第 1 轮（vision FAIL → PASS）

## 0. 根因

`vision-review` 唯一 Critical：`tests/final/tutorial-after-skip.png: 目标不可见`（goal_visible=false，readable 3/10）。这是跳过引导后的纯玩法画面——场上只有蓝（玩家）/红（对手）两个布偶对峙，没有目标指示，视觉模型无法判断「敌人在哪、要打谁」，readable 被拖到 7.2，整体判 FAIL。

## 1. 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 新增 `marker(text,color)`：用 `CanvasTexture + THREE.Sprite` 在角色头顶画「药丸 + 指向三角 + 文字」标记（`depthTest:false` 始终可见）。② 玩家头顶 `YOU`（蓝 `#3b82f6`）、每个存活对手头顶 `ENEMY`（红 `#ef4444`），随角色位置移动；对手死亡/回到标题屏时隐藏。③ 对手头部刚体颜色由麻布 `burlap` 改为 `enemyRed`，消除静态红头 + 动态麻布头重叠造成的浑浊。 |
| `src/ui/ui.js` | ① 箭袋 HUD 由 `➳ 5`（视觉模型 OCR 成 `-> 5`，含义不明）改为 `Arrows: 5`（用 `t('arrows')`）。② 教程卡标题与正文分离：标题走新 `tut_N_t` 短标题，正文走 `tut_N` 详情，修复「Drag to draw the bow… 重复两行」。 |
| `config/locales.js` | en/zh 各新增 4 个 `tut_N_t` 短标题（标题/正文解耦），key 对齐（各 59）。 |

未改动：玩法与判定几何（`src/game/sim.js`、`config/game.config.js`）、SDK、音频、`design.json`。

## 2. 门禁真实输出（重跑后）

- `node --test`：**19/19 pass**（0 fail）
- `fun-audit`：**PASS · 100/100**（26 pass / 0 warn / 0 fail）
- `i18n-check`：**OK**（en/zh 各 59 key，0 missing/empty）
- `asset-check`：**PASS · 3/3**（5 项素材，代码内 4/4 引用可解析）
- `tutorial-check`：**PASS**（4 步，visible/skip/persisted/replay 全 true）
- `sdk-check`：**pass**（0 console/page error，0 失败请求，SDK 域名拦截后降级可用）
- `verify-game`：**pass**（0 errors / 0 failed requests，fps 60 / avgFrameMs 16.67）
- `selfplay`：**OK**（greedy 3 条清 5 关，firstWin 2.25s，lat 0.6ms）
- `fun-report`：**PASS**（10 pass / 0 warn / 0 fail；行动 1851/min、空转 3%、事件 15 种、推进 100%、死亡 100%）
- `vision-review`：**PASS** · readable 8.4 / silhouette 6.6 / style 7.4，0 Critical

vision-review 逐张：

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 |
| --- | --- | --- | --- | --- |
| desktop.png | 8 | 6 | 7 | Y |
| mobile.png | 9 | 6 | 7 | Y |
| tutorial-after-skip.png | 8 | 7 | 6 | Y |
| tutorial-first.png | 8 | 7 | 9 | Y |
| tutorial-replay.png | 9 | 7 | 8 | Y |

## 3. 截图路径

- `tests/final/desktop.png`（1280×720）
- `tests/final/mobile.png`（1688×780）
- 引导：`tests/final/tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png`
- 评审报告：`tests/final/vision-review.json` / `.md`

## 4. 未做项 / 已知 bug

- 对手布偶是「静态站桩 figure + 物理刚体 parts」双份渲染：静态 figure 只提供弓，刚体 parts 才跟随物理。静止时重叠看起来没问题，但倒地后静态 figure 仍留在原地（只有刚体瘫软），中景偶尔可见残影。未在本轮处理——不影响 vision 判分与玩法，后续美术升级时可删掉静态 figure 的躯干/头/四肢，只保留弓。
- `pipygames.com/sdk/config.json` 等请求为 vendored `pipysdk.js` 运行时自带，sdk-check 已按「SDK 域名拦截降级」判 PASS。

## 5. 最不满意一处

玩家/对手头顶的 `YOU`/`ENEMY` 标记在沙色背景下对比度仍偏弱（vision 反复提到「红色边框与沙地对比度偏低」「蓝色标签略模糊」）。这是程序化占位方案，等 Lead 的 AI 素材（天空/地面贴图、角色原画）到位后，标记可以换成更醒目的描边阴影或直接下沉到 3D 头饰。
