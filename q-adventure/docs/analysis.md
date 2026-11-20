# Q ADVENTURE · 源码分析（改造前）

源码：`/Users/admin/remake-src/Q萌大冒险客户端creator/`（Cocos Creator，TS/JS）。

## 结论

原作实际是**俯视角摇杆射击/乱斗**（摇杆移动 + 技能摇杆 + 子弹/拳头/突刺 + 15 个行为树机器人互杀），不是严格意义的横版平台。spec 的 P0 是**品类重塑**：保留「行为树敌人（巡逻/追击）」与「Q 版角色 + 血量 + 重生点 + 收集升级」的骨架，改成横版平台跳跃（跑/二段跳/蹬墙跳/踩敌/收集星星金币/终点过关）。因此本作是「改造」而非「移植」：规则骨架 1:1 借鉴行为树敌人，角色/场景/音乐全原创。

## 关键事实（文件:行号）

| 事实 | 位置 | 本作对应 |
| --- | --- | --- |
| 行为树：`Sequence[Priority[Sequence[Look(150), Attack], Patrol]]` | `assets/BehaviorTree.js:85` | 敌人状态机：视野内追击 → 否则巡逻 |
| Look 判定：与玩家距离 < radio(150px) → SUCCESS | `assets/scripts/Lib/Look.js:22-32` | `ENEMY.SIGHT` 视野半径 |
| Patrol 叶子 → `master.Patrol(dt)` | `assets/scripts/Lib/Patrol.js:23-26` | 巡逻态左右往返 |
| Patrol：每 2–3s 随机换向、`Speed(50)*dt` 移动、夹 walkRect、按朝向翻 scaleX | `assets/scripts/game/RobotHero.ts:66-92` | 巡逻速度/边界夹取 |
| 敌人初始速度 `70 + rand*3` | `assets/scripts/EnemyPrefab.js:99` | 巡逻速度 |
| 敌人两级属性（hp/attack/crit/hit/cd） | `assets/scripts/EnemyPrefab.js:109-144` | 敌人分档（本作用追击速度区分） |
| 摇杆驱动移动 `Speed*Cspeed*dt`，夹 walkRect/obsRect | `assets/scripts/game/GameControl.ts:197-236` | 左右跑 + 边界夹取 |
| 倒计时 210s，每秒 `-1` | `assets/scripts/game/GameControl.ts:68,80-95` | 本作无倒计时（平台过关制） |
| 存活每秒 `score++` | `assets/scripts/game/HeroBase.ts:120-126` | 本作改为金币/星星计分 |
| 死亡 → 5s 后复活 | `assets/scripts/game/HeroBase.ts:146-148` | 本作重生点机制 |
| 宝石拾取 → exp+1 → 升级（crit+0.05） | `assets/scripts/game/HeroBase.ts:179-199` | 星星/金币收集 |
| 子弹命中：暴击 ×2，击杀 +100 分 | `assets/scripts/game/HeroBase.ts:201-250` | 踩敌回弹（signature） |
| 敌人按固定网格 + 延时批量生成 | `assets/scripts/EnemyController.js:34-38,116-128` | 关卡静态敌人布置 |
| 朝向：按方向角翻 `scaleX` | `assets/scripts/EnemyTrigger.js:76-91` | 角色/敌人朝向翻转 |

## 保留 / 放弃

- **保留**：行为树敌人（Look→Chase / Patrol）、Q 版角色 + 血量 + 重生点、收集升级的成长骨架、多敌人。
- **放弃**：原作全部 IP 素材/角色名、俯视角摇杆射击、子弹/拳头/突刺技能、机器人互杀排行榜、社交/签到/抽奖等外围系统（spec 反范围）。
- **原创新增**：果冻豆骑士救公主叙事、果冻弹跳（二段跳挤压形变）、踩敌果冻压扁回弹、果冻吸附（贴墙下滑+蹬墙跳）、鼓点跳（节拍起跳 +15% 高度）、三场景包（糖果丘/云端/夜林）、12 关机关轮换。
