# merge-2048 · 源码分析（改造自「合到2048」）

> 源码：`/Users/admin/remake-src/creator-合到2048/GetTenAddOne/`（Cocos Creator 工程）
> 结论先行：原工程名 `GetTenAddOne`，实现的是「**点选同值相邻块合并**」的 5×5 消除玩法，**不是**经典 2048 滑动合并。spec 的 P0 已明确把玩法规则重新定义为经典 2048（4×4 滑动合并），本作按 **spec P0** 交付，原工程的滑动/合并/生成/失败判定只作品类参考。

## 入口 → 主循环 → 输入 → 判定 → UI

| 环节 | 原工程事实（文件:行号） | 本作改造 |
| --- | --- | --- |
| 入口 | `assets/script/Start.js:8-40`：标题页铺背景 + 呼吸缩放标题 + 点 Start 切场景 | 单页 `index.html` + `src/main.js` 状态机 |
| 主循环 | `TenGame.js:100` `onLoad` → `startGame()`；无逐帧 update（纯事件驱动） | `src/main.js` 60fps rAF 渲染 + 离散回合逻辑 |
| 输入 | `TenTile.js:19-28` 每块 `TOUCH_START` → `game.operateLogic(row,col,num)` | 方向键/WASD/滑动手势 → `run.step({dir})`；`E` 键/按钮触发跃迁 |
| 合并判定 | `TenGame.js:248-322` `operateLogic`：`scanAround`（`TenGame.js:178-246`）四向递归找同值相邻块，≥2 则合并到点选块、值 +1 | `src/game/sim.js` `slideGrid` 四向滑动 + 同值翻倍合并 |
| 掉落/生成 | `TenGame.js:324-425` `moveAllTileDown`：向下压实空位 → 0.3s 后按 `maxNum` 概率生成新块 | 每有效步生成 2/4（`config/gameplay.js` SPAWN） |
| 失败判定 | `TenGame.js:381-422`：2s 后遍历，无相邻同值即 `gameOver` | `sim.js checkLose`：四向 `slideGrid` 均无变化即 dead |
| 数值/档位 | `TenGame.js:3-4` `add[]` / `num2048[]`；`_big` 记录连击指数 | 吨位档位 `config/gameplay.js BUILDINGS`（128/256/512/1024/2048） |
| UI | `TenGame.js:426-461` `gameOver`/`relive`/`showGod`；`Home.js`/`RankingView.js` | `src/ui/` 标题/暂停/结算/设置/HUD/引导 |

## 原工程与本作差异（为什么不是换皮）

- 原工程是**点选式 5×5 消除**；本作按 spec P0 做**4×4（或 3×4 窄盘）滑动 2048**，操作从「点一块」改成「方向键/滑动全盘」。
- 原创主题：数字 = 殖民舰吨位，合并 = 舰队整编；三个场景包（近地轨道/小行星带/星云深处）。
- 原创机制：**引力井**（每 N 步随机格锁定滑入数字 3 步）+ **跃迁引擎**（每关 1 次强制合并任意两个同值格）。
- 原工程依赖 Bmob 后端 / 微信分享 / 红包复活（`TenGame.js:106-115,440-459`），本作全部移除，接入站点 pipysdk 统一出口。
