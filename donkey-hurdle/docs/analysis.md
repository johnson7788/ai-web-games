# 源码分析 — 奔跑吧小驴（donkey-hurdle 改造对象）

源码根：`/Users/admin/remake-src/奔跑吧小驴/奔跑吧小驴/MainGame/`（Cocos Creator 工程）

## 1. 工程结构与入口

- `assets/scripts/Game.js`：场景入口组件，`onLoad/start` 均为空壳（`Game.js:39-50`），仅挂 `UIMgrNode` 属性。
- `assets/scripts/UIGame.js`：**实际玩法核心**（跳跃判定 / 计分 / 状态机 / 场景块管理）。
- `assets/scripts/Player.js`：小驴角色，只负责跳跃动作与回调。
- `assets/scripts/ItemManager.js`：物品池（草/玉米/萝卜/金币）。
- `assets/scripts/DataManager.js`：分数 / 金币 / 分享复活状态。
- `assets/scripts/UIGameOver.js`：结算 / 复活 / 分享复活。
- `assets/scripts/Net.js`：启动时拉取远程分享配置（`Net.js:43-64`，`https://xiao.zhuceqq.com/config.txt`）。
- `assets/scripts/SoundManager.js` / `SoundType.js`：BGM 循环 + 跳/掉落/金币音效（`SoundManager.js:52-76`）。
- `assets/prefab/Block.prefab`：障碍/落脚块 prefab（spec 中「block.js」实为此 prefab，无独立 .js 逻辑）。

## 2. 原版核心玩法（事实带行号）

**2.1 状态机**（`UIGame.js:19-33`）
`GS_Ready(0) → GS_WaitOP(2) → GS_PlayerJump(3) → GS_WaitOP / GS_Over(4)`，`GS_Pause(1)` 由导演暂停实现。

**2.2 输入 → 方向判定**（`UIGame.js:249-297`）
- 首次点击即开始（`GS_Ready → GS_WaitOP`）。
- 触摸点换算到 UIGame 局部坐标：`touchPos.x >= 0 → moveDirX = 1`（向右），否则 `-1`（向左）。

**2.3 跳跃与场景移动**（`UIGame.js:306-335`）
- 取当前块的下一个块 `nextBlock`，玩家目标位 = `BlockTop + nextBlock.position`。
- `Player.jump(0.15, offVec)`（`Player.js:44-59`，`cc.jumpBy` 抛物线跳），同时 `BlockNode` 反向 `moveBy(0.15, offVec)` 平移，实现「固定镜头、块相对移动」。
- 跳完回调 `onPlayerJumpEnd`（`Player.js:81-84`）。

**2.4 跳跃结束判定与计分**（`UIGame.js:339-480`）
- 若 `moveDirX > 0 && 当前块.x > 上一块.x`（或反向）→ 方向正确，加分数/金币（`ItemType` 映射：None=1 分 / Grass=5 / Corn=20 / Radish=10 / Coin=+1 金币，`UIGame.js:412-459`）。
- 方向错误 → `GS_Over`（`UIGame.js:463-469`）。
- 块落地后 `scaleTo(1.5, 1, 0)` 下移压扁，超时未跳 → `onBlockDownFinish → GS_Over`（`UIGame.js:489-502, 671-680`）。

**2.5 场景块与物品池**（`UIGame.js:505-552`，`ItemManager.js:71-104`）
- 初始化 30 个 Block，随机左右偏移 `BlockOffVec`（80,80）铺设。
- `ItemManager` 按概率表随机给块顶挂物品，物品池预建 3 个/类，`getRandomItemType()` 用累计概率（`ItemManager.js:112-127`）。

**2.6 复活/分享**（`UIGameOver.js:122-190`，`DataManager.js:95-138`）
- 复活消耗 20 金币；微信分享复活（`wx.shareAppMessage`）；分享开关来自 `Net.js` 远程配置。

## 3. 结论：原版是「跳一跳」式跨块游戏，非横版跑酷

原版其实是「左右跳块 + 收集 + 超时判负」的竖屏跳跳类游戏，不是 spec 里的横版跨栏跑酷。改造目标（per spec）是把它**重释为横版自动奔跑越障**：
- 保留「驴 + 障碍块 + 掉落判负 + 距离计分 + 越走越快」的意象；
- 原版的「块间跳跃方向判定」→ 重释为「障碍类型判定跳法」（矮栏短跳 / 高墙长按高跳 / 坑洞精确起跳）；
- 原版的物品（草/玉米/萝卜/金币）→ 原创为「陶罐 = 血量」资源系统（撞一次掉一罐，掉光散架）；
- 原版微信分享/远程配置/金币复活 → 全部弃用（本项目走站点 SDK + 纯离线，无微信层）。

## 4. 原创改造要点（对应 spec）

- **陶罐=血量**：撞障碍掉一罐，掉光判负（血量可视化 = 驴背上 + HUD 的罐）。
- **卸货跳**：主动丢一罐（K）换一次超高跳——资源换位移。
- **窄桥节奏段**：等距连环栏，需踩固定节拍（对应原版「方向判定」被节奏判定取代）。
- **三场景包**：丝路晨（沙金）/ 绿洲午（翠绿）/ 星夜（蓝紫），12 段推进换障碍轮换。
- 以上均落在 `config/design.json`（机器可读设计源）与 `config/gameplay.js` / `config/levels.js`（数值/关卡）中。
