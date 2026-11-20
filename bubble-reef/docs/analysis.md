# bubble-reef 源码分析（泡泡龙 Cocos 源码 → 原创网页版）

源码目录：`/Users/admin/remake-src/cocos-creator-泡泡龙-源码/paopaolong/`

## 结论

原作为 Cocos Creator 竖屏泡泡龙，核心是一个**六边形网格上的「发射—吸附—同色连通消除—悬空掉落」**循环。
本作按「玩法 1:1 还原、角色/场景/音乐全原创」重构为横屏 1280×720 纯静态网页游戏，
并新增三场景包、潮汐瞄准线、气泡弹（百搭泡）、12 关推进与顶棚下沉/触底判负。

## 事实清单（文件:行号）

### 入口与主循环
- `assets/script/BubbleMgr.ts:28` `onLoad()` — 关卡初始化 `init("lv1")`、监听 `EVENT.TOUCHEND_SHOOT` 开始射击、`_createOneShooter()`。
- `BubbleMgr.ts:47` `update(dt)` — 每帧若 `isShooting`，先 `_bubbleMove(dt)` 再 `_isCollided()`。
- `BubbleMgr.ts:31` 射击事件回调 — 角度（度）转弧度后 `shootDir = (-sin r, cos r)`（向上为 y 正方向，竖屏坐标系）。

### 瞄准与输入
- `TouchMgr.ts:27` `_touchStart` / `:32` `_touchsMove` — 拖动即更新炮台角度。
- `TouchMgr.ts:37` `_touchEnd` — 松手时按最终角度发出 `TOUCHEND_SHOOT`。
- `TouchMgr.ts:45` `convertToDegree` — `atan2(y,x)` 转度后 `-90`，再夹到 `[-80, 80]`。
- **安全注意** `TouchMgr.ts:12` — 原作在非微信平台注入一段十六进制混淆的百度统计脚本（`hm.baidu.com/hm.js`）。本改造**刻意不复刻**，埋点只走站点 SDK。

### 网格几何（`Util.ts`）
- `Util.ts:3-7` 常量 — `SCREEN_W=720`、`SCREEN_H=1280`、`BUBBLE_R=40`、`BUBBLE_Y=40*√3`。
- `Util.ts:16` `convertRowColToPos` — 偶数行 `x = R*((row%2)+1) + col*2R`，`y = SCREEN_H - (R + row*BUBBLE_Y)`（顶部起、向下增长）。
- `Util.ts:25` `convertPosToRowCol` — 四舍五入反解行列。
- 六邻域偏移在 `BubbleMgr.ts:117-133`：偶数行 `leftTop = col-1`，否则 `leftTop = col`。

### 发射与碰撞
- `BubbleMgr.ts:229` `_bubbleMove` — `speed=1000`；`x < R` 或 `x > W-R` 时水平分量取绝对值（**左右壁反弹**）。
- `BubbleMgr.ts:55` `_isCollided` — 对每个泡泡先粗筛 y/x 差 ≤2R，再做 `dis ≤ 2R` 精确判定；触顶 `y > SCREEN_H - R` 也停止。

### 吸附与消除
- `BubbleMgr.ts:87` `_setBubblePos` — 命中坐标 → 行列取整 → 吸附写入 `bubblesArray` → `_mapColor`。
- `BubbleMgr.ts:102` `_mapColor` — 从落点做**同色六邻域 flood fill**，`count ≥ 3` 则逐泡播放消除动画，并 `scheduleOnce(_testUnLinked, 0.3)`；不足 3 直接 `_nextBubble`。
- `BubbleMgr.ts:167` `_testUnLinked` — 从**顶行所有非空泡**做连通标记，未标记的（失去支撑）播放掉落动画；全连接则 `_nextBubble`，有掉落则延迟 0.6s 再 `_nextBubble`。

### 发泡
- `BubbleMgr.ts:270` `_createOneShooter` — 随机颜色 `randNum(1,4)`，置于炮台位置，作为 `shootBubble`。
- `BubbleMgr.ts:241` `init` — 按 `levelData.json[str]` 二维数组初始化，`0` 为空。

### 关卡数据
- `assets/data/levelData.json` — `lv1` 12 行（偶数行 9 列、奇数行 8 列），颜色 1–4，`0` 为空。仅一关，无下沉/触底/计分。

## 还原映射（原作 → 本作）

| 原作机制 | 本作实现 |
| --- | --- |
| 六边形网格 + 行列↔坐标 | `config/gameplay.js`（parity 携带版，支持顶棚下沉不破坏邻接） |
| 六邻域 flood fill 同色消除 | `src/game/grid.js#matchCluster` |
| 顶行连通标记 + 悬空掉落 | `src/game/grid.js#attachedSet` / `#floatingCells` |
| 左右壁反弹 + 触顶吸附 | `src/game/grid.js#traceShot` / `src/game/sim.js#moveFlying` |
| 同色 ≥3 消除 | `src/game/sim.js#land`（match → drop → 判负/通关/下沉） |
| 炮台瞄准 + 松手发射 | `src/main.js`（pointermove/pointerup → aimAngle/shootQueued） |

## 新增（原创改造，spec 要求）

- **顶棚每 N 发下沉一行**（原作无）：`src/game/sim.js#sink`，每 `shotsToSink` 发顶部 unshift 一行新泡（parity 翻转，既有行 parity 不变 → 邻接不破坏）。
- **触底判负**（原作无）：`src/game/grid.js#anyTouchingDeathLine`，泡泡中心 y ≥ `DEATH_Y` 即死；下沉时立即判负（不等到下一发）。
- **清除率通关**（原作无）：`clearedTotal / (clearedTotal + countBubbles(grid))` ≥ 关卡目标。
- **潮汐瞄准线**：每关 1 次免费轨迹预览（`src/game/sim.js#step` 的 `usePreview`）。
- **气泡弹/百搭泡**：攒 3 连击换一颗任意色泡泡，落点取邻域多数色（`resolveWildcardColor`）。
- **三场景包 + 12 关 + 岩礁障碍泡/移动洋流/双层顶棚/金泡必消**：`config/levels.js`、`src/render/theme.js`。
