# stack-sky 源码分析

> 事实按 `文件:行号` 记录。源码路径（spec 提供）：
> `/Users/admin/remake-src/叠叠乐-前后端都有-前端cocoscreator后端js/`

## 0. 关键发现（先读这段）

spec 里描述的源码是「块左右往复移动、点击截停、超出去边裁切、块变窄、塔越来越高」的经典 Stack 塔式玩法；但该目录下**实际是一套「把几何形状拖进容器、靠物理引擎堆叠、倒计时判定过关」的形状堆叠游戏**（更像「叠叠乐/装盒子」），二者不是同一玩法。

- 证据：`client/main/assets/Scripts/Game.js` 全程是 `PhysicsCubeCollider` / `RigidBody` / `TOUCH_MOVE` 拖拽 + `dblclick` 松手（`Game.js:412-442`），没有「左右往复滑动块」「裁边变窄」逻辑；`Clock.js:17-44` 是 8 秒倒计时过关。
- 结论：**玩法规则以 spec 的 P0 还原为准**（spec 明确列出了完整规则），源码只作为「塔式堆叠」品类参考。本作 `src/game/sim.js` 严格实现了 spec P0 的经典 Stack 规则 + 风切/神龛原创改造。

## 1. 源码入口与主循环

| 关注点 | 位置 | 事实 |
| --- | --- | --- |
| 启动场景 | `client/main/assets/Scripts/Launch.js` | 平台初始化、登录、进入 Home |
| 主游戏控制器 | `client/main/assets/Scripts/Game.js:309-448` | `onLoad` 置 `state=WAIT`、读 `window.level`；`start()` 启用物理/碰撞，注册 `GAME_OVER`/`GAME_PASS`，绑定拖拽与双击 |
| 输入 | `Game.js:412-442` | `dynamicBox.on(TOUCH_MOVE)` 拖拽形状位移；`dblclick` 松手→加 RigidBody 变 Dynamic 掉落 |
| 形状下发 | `Game.js:467-479` | `nextFigure()` 从 `dynamicFigures` 队列 `shift()` 下一个形状，置 `opacity=100` |
| 倒计时 | `client/main/assets/Scripts/Clock.js:17-44` | 放完最后一个形状后 `countdown()`，`rotateBy(8,360)` 8 秒后 `finish` → 发 `GAME_PASS` |
| 成功/失败 | `Game.js:363-410` | `clock.on("finish")` → `GAME_PASS`；`GAME_OVER` → `state=FAIL` → `GameFail.show()` |

## 2. 状态与事件

- `client/main/assets/Utils/Constants.js:158-175`：`GAME_STATE` = `WAIT/ING/SUCCESS/FAIL`。
- `Constants.js:196-200`：`GAME_EVENTS` = `GAME_OVER` / `GAME_PASS` / `LEVEL_PAGES_LOADED`。
- 关卡选择：`client/main/assets/Scripts/LevelLoader.js:108-141` 校验解锁、`Service.startGame({level})` 后 `loadScene("Main")`。

## 3. 关卡数据

- 关卡是服务端下发字符串 `LVLCODE`（`Game.js:189-222`），按 base62 编码解析「静态形状」和「动态形状」列表（`getStaticFigures`/`getDynamicFigures`）；形状类型 `r/t/c/h` → cube/triangle/circle/hexahedron（`Game.js:71-86`）。
- 本作不移植这套编码/物理，改造成 spec 的无限叠塔 + 12 段推进（`config/levels.js`）。

## 4. 映射到 stack-sky（本作实现）

spec P0 规则 → 本作实现位置：

| spec 规则 | 实现 |
| --- | --- |
| 顶块左右往复 | `src/game/sim.js:88-110` `updateMoving()`，`OSC_RANGE` 半幅摆动 + 边界反弹 |
| 点击/空格截停 | `src/main.js:28-49`（pointerdown / Space → `dropQueued`），`sim.js:55-64` 上升沿判定 |
| 未对齐部分裁掉、下一块变窄 | `sim.js:147-202` `placeBlock()`：重叠宽度为新宽，余量发 `cut` |
| 完全对齐 perfect 连击、少量回宽 | `sim.js:180-194`：`PERFECT_TOLERANCE` 内 → `perfect`、`PERFECT_RECOVER` 回宽、`perfectCombo++` |
| 宽度过小判负 | `sim.js:159-162`：`overlapWidth < MIN_WIDTH` → `die('narrow')` |
| 高度即分数、镜头上移 | `sim.js:214` `score`（=层数）、`sim.js:264-266` `cameraYFor()` |
| perfect×3 彩云缠绕 | `sim.js:190-194`（`CLOUD_WRAP_COMBO=3`）+ `render/index.js:272-293` 金光/云海 |
| 风切（每 10 层横风） | `sim.js:81-83,113-128`、`config/gameplay.js:26-30` |
| 神龛层（每 15 层恢复宽度） | `sim.js:170-178`、`config/gameplay.js:33-36` |
| 三场景包 | `config/levels.js:5-9`、`src/render/theme.js:3-58`、换章 `sim.js:131-144` |

## 5. 参考实现（黄金参考）

`games/abyss-eel/`（只读）：工程结构、`main.js` 的 `window.__ll` 契约、boot 竞态守卫、教程选择器、selfplay 遥测 schema、`verify.plan.json` 的 `"checks": {"external": false}`、`styles.css` 的 `#rotate`/HUD 响应式，均已照抄并替换为本作内容。
