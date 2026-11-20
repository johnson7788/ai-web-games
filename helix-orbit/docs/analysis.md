# HELIX ORBIT — 源码分析（改造自「球球跳跃 3D」/ falling-ball）

> 源码根：`/Users/admin/remake-src/球球跳跃3D/falling-ball/`（Cocos Creator 工程，TS 源在 `assets/falling-ball/scripts/`）。
> 结论：这是标准的 **Helix Jump 品类**（球沿螺旋塔下落弹跳，旋转塔层让球穿过缺口）。本作只还原**玩法规则**，角色/场景/音乐全原创（熔岩螺旋塔 / 陨石态 / 冰晶冻结 / 岩芯裂隙）。

## 一、入口与主循环

| 事实 | 位置 |
| --- | --- |
| 状态机 `EGameSate { LOBBY, GAMING, GAMEOVER }`，标题(LoginPanel)→游戏(GamePanel)→结算(OverPanel) | `scripts/GameCtr.ts:10-13, 47` |
| 90 秒倒计时（`totalSecond=90`），`setInterval` 每秒 `gameTick` | `scripts/GameCtr.ts:42, 93, 122-150` |
| `gameTick`：`dt<0` 或 `ballCtr.hitRed` 或 `isDeadlock` → GAME OVER，写 `localStorage['score']` 最高分 | `scripts/GameCtr.ts:124-145` |
| 分数 = 通过的层数（`_flag`），显示在 `ScoreLabel` | `scripts/FloorFlagCtr.ts:74` |

## 二、球（BallCtr）

| 事实 | 位置 |
| --- | --- |
| 碰撞回调 `onCollisionEnter`：撞 `Cube`（普通段）→ 弹跳（`velocity_y=10` 向上），撞 `CubeRed`（危险段）→ `_hitRedFlag=1` 判负 | `scripts/BallCtr.ts:45-71` |
| 撞普通段时若连续两次撞到**同一个 cube**（`_tempUuid` 相同）则 `_deadlockCount++`，`isDeadlock = _deadlockCount>=2` → 判负（卡死） | `scripts/BallCtr.ts:31-33, 65-70` |
| 下落速度钳制：`vy` 上限 `velocity_y`(10)、下限 -60 | `scripts/BallCtr.ts:74-83` |
| 重力 `(0,-20,0)`、帧率 60、maxSubStep 1 | `scripts/GameConfig.ts:13-19` |

## 三、塔层旋转（ColumnCtr，玩家输入）

| 事实 | 位置 |
| --- | --- |
| 键盘 A/D 每次按下旋转塔 ±3°（Quat.fromEuler y±3）；触屏拖动按 `delta.x * 0.75` 旋转 | `scripts/ColumnCtr.ts:22-37` |
| 塔层（Floor 子节点）垂直间距 8，重置时 `y = i * -8` | `scripts/ColumnCtr.ts:39-49` |

## 四、层生成与判定（FloorFlagCtr + 场景布局）

| 事实 | 位置 |
| --- | --- |
| 两个地面标记（floorFlag0/1）驱动：当 flag 高于球，取 `floorRoot.children[_flag % len]` 作为模板，把该层每个 Cube/CubeRed 克隆进 `cubeRoot` 并施加向下的力（碎片飞散），再把该层移到 `-(flag+len)*8` 处并随机旋转 `-180..180°`，`_flag++`（=分数） | `scripts/FloorFlagCtr.ts:36-75` |
| 层模板在场景里：每层 8 单位一圈，Cube/CubeRed 放在半径 3.5 的圆上，缺口由「哪些角度没放 Cube」决定；不同层模板缺口数/危险段占比不同 | `falling-ball.scene` 节点 133-243（Floor 系列） |

## 五、还原到本作的规则映射（1:1 规则 + 原创壳）

| 原作 | HELIX ORBIT |
| --- | --- |
| 球沿塔下落、撞普通段弹起 | 同：球沿螺旋塔下落，安全段弹跳 |
| 旋转塔层，缺口对齐时球穿落下一层 | 同：←→/拖动旋转，缺口对齐穿落 |
| CubeRed 危险段判负 | 熔岩段判负（岩浆纹）；陨石态可砸穿 |
| 连撞同段卡死（deadlock≥2）判负 | 同：同层连弹 ≥3 次判负（卡死） |
| 无尽计分（层深） | 同：层深计分 |
| —（原作无） | 原创：连穿 3 层进「陨石态」、冰晶冻结岩浆 5s、每 5 层岩芯裂隙双倍分 |
| 单场景 | 三场景包：岩壳(赭红)/黑曜(墨黑紫纹)/冰帽(青白) |

## 六、渲染方案（伪 3D）

- Canvas 2D 正交/透视椭圆堆叠画螺旋塔（不做真 3D 引擎，参考 tower-climb/marble-dash 的 2.5D 手法）。
- 每层 = 圆环分 8 槽，段/缺口按角度画楔形；球固定屏幕 y，塔层随深度上移。
- 三套色板 + 构图 + 装饰（余烬 / 黑曜碎片 / 雪晶）按深度换章。
