# 源码分析 — constellation-line（改造自「一笔画」）

源码根：`/Users/admin/remake-src/CocosCreator-一笔画-完整源码/一笔画/`（Cocos Creator 项目）。
以下路径相对源码根。

## 1. 入口与数据加载

- `assets/resources/Master/scripts/sc/MainScene.js:24-27`
  `cc.loader.loadRes('SubModules/LB/data/puzzles', ...)` 加载关卡库，赋值 `globalCfg.AllLevelData = v2`。
- `assets/resources/Master/scripts/sc/MainScene.js:19`
  四种模式名：`['简单模式','普通模式','困难模式','大师模式']`；每模式 5 组 × 100 子关（MainScene.js:45-63）。
- 关卡库数据：`assets/resources/SubModules/LB/data/puzzles.json`
  每关形如 `[ [w,h], startIdx, emptyArr, answer ]`：
  - `[w,h]` 网格宽高
  - `startIdx` 起点格索引（row-major）
  - `emptyArr` 挖空的格子索引（这些格不可走）
  - `answer` 一条完整经过所有非空格子的节点索引序列（提示用）

## 2. 关卡解析

- `assets/resources/SubModules/LB/scripts/sc/LevelDataLB.js:13-41` `getLevelData(subLevel)`：
  - 计算全局关卡号 `level = 500*mode + 100*group + subLevel`
  - 把 `w*h` 全填 1，再把 `emptyArr` 对应索引置 0（洞）
  - `start = { x: startIdx%w, y: floor(startIdx/w) }`
  - 返回 `{ w, h, start, grid, answer }`

## 3. 核心判定（关键：这是「节点哈密顿路径」，不是「边欧拉路径」）

- `assets/resources/SubModules/LB/scripts/sc/GamePlayLB.js:150-182` `onTouch`：
  - `getTouchCell(pos)`（GamePlayLB.js:265-274）命中某格
  - `model.choosed` 是已访问格索引序列；`last` = 末格
  - 若点到的格已在 `choosed` 且不是末格 → 回退（`choosed.pop()` 到该格，GamePlayLB.js:166-174）
  - 否则若与末格曼哈顿距离 == 1（上下左右相邻，GamePlayLB.js:175）→ 入栈 + `checkPassLevel()`
- `assets/resources/SubModules/LB/scripts/sc/GamePlayLB.js:227-262` `checkPassLevel`：
  - 过关条件 `this.model.totalCell == this.model.choosed.length`（走遍所有非空格子）
  - 过关后播放缩放动画，弹 `LB:Pass` 结算

**结论**：原作的「一笔画」是**网格节点一笔连（每条边=相邻格，每个节点恰访问一次 = 哈密顿路径）**，起点固定，可回溯；判定靠「是否走遍全部格子」。

## 4. 配置与存档

- `assets/Core/GlobalConfig.js:15-34`：`setting`（soundVolume/musicVolume/unlock/hintCount/levels），
  `saveSetting()` 落 `localStorage['myconfig_settings']`。
- 提示系统 `assets/resources/SubModules/LB/scripts/sc/ModLB.js:60-72` `btnShowTip`：消耗 hintCount 显示 `answer`（提示序列）。

## 5. 本作（constellation-line）的改造决策

规格 `docs/remake-all/games/spec-constellation-line.md` 明确把 P0 定义为**欧拉路径**（「每条边恰走一次」「度数奇点 0 或 2」），
并给出「欧拉回路/开路/双子图/带必经节点」的边型轮换与「节点 5→18」推进。这与原作的节点哈密顿路径不同；
因此本作按**规格**实现为**图上的边欧拉路径**（每边恰走一次），并以「星座连线」主题原创化：

- 星=节点、线段=边；拖动/点按从起点沿未走过的边走边。
- 原创 twist：流星干扰（高关某边被遮 2s）、双星图（两个独立子图切笔）、必经北极星节点。
- 三个场景包（春夜蓝紫 / 夏银河亮白 / 极光冬青绿）换章必换色板+构图+装饰。
- 关卡原创生成：`config/levels.js` 用「链 / 环 / 环+弦 / 双分量」四种模式生成 24 关，
  每个连通分量奇度点恒为 0 或 2（单测 `tests/euler.test.mjs` 逐关验证 + Hierholzer 全量解出）。
