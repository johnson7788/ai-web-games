# DUNE BUGGY — 源码分析（3D赛车 → 伪 3D 沙丘越野）

> 源码：`/Users/admin/remake-src/3D赛车-creator/`（Cocos Creator 3D 赛车 demo）
> 原则：玩法规则 1:1 还原，角色/场景/音乐全原创。

## 1. 入口与装配

- 场景：`assets/demo/simple-car/simple-car.scene`（车 + 地图 + 摄像机 + 四向按钮 + 计分 Label）。
- 地图由 JSON 驱动：`assets/resources/simple-car/map/MapCocos.json`（每项 `{ n, p, r, s }` = 名字/位置/旋转/缩放），
  由 `debug/MapLoaderTesing.ts:27-49` 按名加载 prefab 并 `systemEvent.emit('onMapLoaded')`；
  `debug/MapSpawner.ts` 负责把编辑器摆放的节点导出成这份 JSON（`Interface.ts` 的 `IMapStruct`）。
- 装配中心：`gameplay/MotorCom.ts` —— 依次驱动 `MotorState`（输入态）与 `MotorCtr`（运动），
  并把各组件注册进 `gameplay/InstanceMgr.ts`（静态单例字典，避免循环引用）。

## 2. 输入 → 运动状态

- `gameplay/FourDirButtons.ts:100-126`：W/A/S/D 的 KEY_DOWN/UP 映射到 FORWARD/BACKWARD/TURNLEFT/TURNRIGHT，
  触屏按钮 `:53-98` 同样按 TOUCH_START/MOVE/END 设置位掩码。
- `gameplay/MotorState.ts:26-58`：把按钮位掩码转成 `EMotionState`（POSITIVE/NEGATIVE/NONE），
  左右同按 / 前后同按互斥归零（`:34-40`、`:51-57`）。
- `gameplay/MotorCtr.ts:26-42`：满油门时 `_forceZ += vertical.x * dt`，刹车 `-= vertical.x * dt`，无输入则 `_forceZ = 0`。
  **这是「油门/刹车按加速度累积、速度受极速钳制」的原作手感来源。**

## 3. 运动（关键数值规则）

- `gameplay/MotorCtr.ts:44-50`：`_forceZ` 被 `clamp(_forceZ, -vertical.y, vertical.y)` 钳制在极速内，
  再 `Vec3.transformQuat` 转到车体朝向，直接写回 `setLinearVelocity`（原作是"速度直写"，没有轮胎滑移模型）。
- **转向随速度缩放**：`gameplay/MotorCtr.ts:52-59`
  `factor = |1.5 * _forceZ / vertical.y|`，转向角 = `torque.x * dt * factor`。
  即：速度越快，同样的方向输入转得越快；原地（`_forceZ==0`）不能转向。这是伪 3D 里最需要保真的一条。
- `gameplay/MotorCom.ts:17-19`：重力 `(0,-30,0)`；`:38-44` 地图加载完成后才 `enabled=true` 并启用刚体重力（防出生坠落）。

## 4. 摄像机 / 计分 / 地图构成

- `gameplay/CameraFollow.ts:27-38`：第三人称跟随，位置与朝向各 `lerp 0.2` 平滑。
- `gameplay/BonusMgr.ts:34-55`：收集 `Bonus-Cocos`（金币），碰到触发 `onTriggerEnter`，`score++` 并更新 Label。
- 地图 `MapCocos.json`：Straightaway（直道，缩放 18x）、Bend1/Bend2（弯道）、Crossway/CrosswayCenter（路口）、
  house01/02（房子）、Decoytrenches1-3（沟壑）、Bonus-Cocos（一排排金币）。原作是**自由漫游吃金币**，无计时/圈速/检查点。

## 5. 规则映射（原作 → dune-buggy）

| 原作事实 | 出处 | 本作落地 |
| --- | --- | --- |
| 油门/刹车加速度累积 + 极速钳制 | MotorCtr.ts:26-50 | `sim.js` 的 `ACCEL/BRAKE/DRAG` + `clamp(speed, 0, maxSpeed)` |
| 转向随速度缩放（factor） | MotorCtr.ts:52-59 | `playerX += steer * STEER_RATE * (speed/MAX_SPEED) * grip * dt` |
| 左右/前后同按互斥 | MotorState.ts:34-57 | `steer = right-left`、`throttle/brake` 互斥由 main 输入层保证 |
| 第三人称跟随 | CameraFollow.ts | 伪 3D 相机：车固定屏幕下方，道路随 playerX/cur 曲线偏移 |
| 金币收集 | BonusMgr.ts | 改为**检查点 + 时间目标**（spec P0：检查点/圈速/计时） |
| 直道/弯道/沟壑地图 | MapCocos.json | 程序化 `track.js`：curve（弯）+ y（沙丘起伏）+ terrain 分段 |

## 6. 原创改造（spec 差异化）

- **胎压**：高胎压极速 ×1.16 但抓地 ×0.74（沙地打滑），低胎压极速 ×0.80 但抓地 ×1.26（稳）——进站式取舍，T 键切换。
- **沙脊线**：`track.js` 在部分段标记 `ridge`，骑在中心（|playerX−ridgeX|<RIDGE_HALF）时极速 ×1.26 且持续加速；偏离则失去。
- **沙暴**：赛段级 `storm` 0..1，降低极速/抓地 + 渲染雾 + 减少可见段。
- **跳台签名瞬间**：`jump` 段触发腾空，相机拉升（`camH`+`horizon`+），俯瞰落点。
- **三场景包**：晨沙（金）/ 午漠（白热）/ 暮丘（橙紫），`render/theme.js` 换色板 + 构图 + 装饰。

## 7. 推进结构

- 12 赛段（`config/levels.js`），每段时间目标 `parSec`，超过 `parSec + DNF_GRACE` 即 DNF。
- 每 90m 一个检查点（事件 + 视觉拱门），终点横幅作为终极目标。
- 完赛评级 `ratingFor`：gold/silver/bronze/finish。
