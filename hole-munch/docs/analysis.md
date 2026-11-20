# HOLE MUNCH · 源码分析（改造自 黑洞大作战 / simple-hole）

> 参考实现只读：`games/abyss-eel/`。源码只做玩法规则还原，不复用任何素材/IP 名。

## 1. 源码位置

`/Users/admin/remake-src/cocos-creator-3d-黑洞大作战/simple-hole/assets/demo/simple-hole/scripts/gameplay/`

这是一个 Cocos Creator 3D 的**物理演示 demo**，不是完整游戏：没有计分、没有倒计时、没有 AI 对手。
spec 的 P0（限时比分 + 5 AI 名次赛）需要我在原创实现里补上。

## 2. 核心机制（事实 + 文件:行号）

### 2.1 黑洞吞物 = 两个球形触发器的「吸」+「吞」

`EntitySetup.ts:29-56`：role 节点挂了两个 SphereCollider：

- **collider0（radius=2，内圈）**：`isTrigger=true`，group=G_ROLE，mask=G_BODY。
  `onTriggerEnter`（`EntitySetup.ts:59-72`）→ 物体进入内圈后把它的 mask 加上 ROLE，
  然后 `setTimeout(750ms)`：若该 body 的 `worldPosition.y < 0`（已沉到地平面下）→ `active=false`（**吞掉**）。
- **collider1（radius=3.2，外圈）**：`onTriggerStay`（`EntitySetup.ts:74-84`）→
  每帧对 body 施加 `applyImpulse(_impluse, _dir)`，方向指向 role 中心（**吸入**）。

结论：外圈 ~3.2 把物体吸向中心，内圈 ~2 判定进入 + 750ms 下沉后吞掉。
我把它抽象成：**suckRadius（外圈）→ 吸入螺旋 → coreRadius（内圈）→ 吞并加面积**。

### 2.2 移动：速度向量 + 阻尼 lerp + 边界 clamp

`MotionCtr.ts`：

- 键盘 `onKeyDown/onKeyUp`（`MotionCtr.ts:74-97`）：W/A/S/D/Q/E 直接改 `_velocity` 分量（+1/-1/0），
  边沿语义 =「按下设 1，松开设 0，不重复叠加」。SHIFT = 移速 ×5（`moveSpeedShiftScale=5`）。
- 触屏 `onTouchStart/onTouchMove/onTouchEnd`（`MotionCtr.ts:99-121`）：
  按下请求指针锁定；拖动 delta ×0.01 作为速度，再按符号加 0.75 偏移（`MotionCtr.ts:113-116`）。
- `update(dt)`（`MotionCtr.ts:40-48`）：`transformQuat` 旋转速度向量 → 累加到目标位置 →
  `Vec3.lerp(position, target, dt/damp)` 阻尼平滑 → `clamp(-45,45)`。

结论：**位置是阻尼追踪目标，边界 clamp 到场地内**。我的 sim 用同样的「目标追踪 + lerp + 边界」，
并把速度随体型增大而变慢（spec 的成长代价）。

### 2.3 场地与物体生成

`Instantiate.ts`：

- 重力 `PhysicsSystem.instance.gravity = (0, -200, 0)`（`Instantiate.ts:26-31`）。
- 物体：`boxAmount=50` 箱子 + `sphereAmount=50` 球（`Instantiate.ts:33-58`），共 ~100 个可吞物。
- 三种分布算法（`Instantiate.ts:60-81` + `EShapeAlgorithm.ts`）：
  RANDOM（`random_algorithm`，-45..45 均匀）、X_SQUARE_2、SPIRAL。
- 物体 mask 初始化 `setMask(-1)`，group=G_BODY（`Instantiate.ts:41-56`）。

结论：**可吞物散布全场地，数量 ~100**。我的原创版本把物体分级（路灯/轿车/巴士/楼栋/摩天楼），
按 match 递进解锁，数量由 config 控制。

### 2.4 分组掩码

`EGroupMask.ts:3-7`：`G_PLANE=1<<0`、`G_ROLE=1<<1`、`G_BODY=1<<2`。
分组只做物理碰撞过滤，逻辑等价于「hole 只吞 body、body 掉下 plane」。

### 2.5 对象池

`PrefabPoolUtil.ts:5-53`：按 poolName 复用 Prefab 节点，避免频繁实例化。
我的原创实现是纯 Canvas 程序化渲染，物体为轻量实体对象，不需要对象池（数量上限 config 控制）。

## 3. 原 demo 没有、由我原创补上的部分（对应 spec P0 + 原创改造）

| 能力 | 来源 |
| --- | --- |
| 限时 2 分钟 + 名次赛（5 AI） | spec P0 |
| 吞物加面积 / 大洞吞小洞 | spec P0（demo 只做了吞物，没做洞吞洞、没做成长） |
| 午夜黑洞主题：路灯→轿车→巴士→楼栋→摩天楼 | spec 原创改造 |
| 吞楼签名瞬间：楼体碎块旋转吸入 + 全屏震感涟漪 | spec signature |
| 引力连锁（3s 内同区吞 10 物 → 引力井 +30% 持续 5s） | spec 区别点 |
| 吞噬竞速（每 30s 陨石雨，吞陨石三倍成长） | spec 区别点 |
| 三场景包：老城街区（暖黄）/ 港口（青蓝）/ 未来城（霓虹粉紫） | spec 原创改造 |
| 12 场推进 + 场间三选一成长（引力半径/移速/吞速） | spec 推进结构 |
| 触屏摇杆 + 指针移动 | spec 操作 |

## 4. 改造映射（demo 常量 → 我的 config 命名）

| demo 事实 | 我的实现 |
| --- | --- |
| 内圈 radius 2 / 外圈 radius 3.2 | `SUCK.outerK = 0.5`（外圈=r+obj.r*0.5）、`SUCK.coreK = 0.6`（内圈=r*0.6） |
| 750ms 下沉后吞 | `SUCK.time = 0.6s` 吸入时长 |
| moveSpeed / shift×5 / damp 0.2 | `MOVE.base` / `MOVE.lerp` / `MOVE.speedFalloff`（体型代价） |
| clamp(-45,45) | `WORLD.WIDTH/HEIGHT` 边界 + `HOLE.R` 边界 |
| 物体 ~100 个 | `MATCH.density` 按场次递进 |
