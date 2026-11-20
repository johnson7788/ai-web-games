# 源码分析：超能陆战队-creator → STAR SLAYER

> 源码路径 `/Users/admin/remake-src/超能陆战队-creator/`（Cocos Creator）。玩法规则 1:1 还原，角色/场景/IP 全原创化（不出现大白等原作形象）。

## 1. 入口与主循环

- `assets/Script/Game/GameStart.js:20-51` 开局 `kaihuo()` 绑定三把枪（qiang1/2/3）的 hold-to-fire，`start()` 监听 `subHp / 护盾 / playMusic` 等全局事件，并读 `localStorage` 恢复道具库存。
- `assets/Script/Game/PlayerControl.js:16-69` 主角 `start()` 读库存（子弹/火箭弹/火焰弹/冰冻/护盾/轰炸），监听 `playHpReduce / propsADD / reduceZidan / updateProps`，开碰撞管理器。
- 主循环是 Cocos `update()` 驱动：`PlayerControl.js:137-160` 每帧 `moveType()` + `nearestPosition()`（自动面向最近怪）。

## 2. 输入

- 键盘：`PlayerControl.js:121-136` `onKeyDown/onKeyUp` 只处理 WASD（`cc.macro.KEY.w/a/s/d`），`moveXL/XR/YU/YD` 四方向布尔，`moveType()` 按 `speed=10` 逐帧位移并夹在屏幕内（`PlayerControl.js:161-186`）。
- 射击：`GameStart.js:52-100` 三个枪按钮 `TOUCH_START` 发 `开火1/2/3` 并 `schedule(shootN, 0.2)` 连发；`zidan.js:20-63` 监听 `开火1/2/3` 检查弹药 → 实例化子弹 → `reduceZidan` 扣库存。

## 3. 攻击与判定

- `assets/Script/Game/zidan.js:82-103` `yidalipao()`：从枪口 `firePointEnd` 沿 `launchDirection()`（枪口朝向）发射，`moveBy(1, winSize*dir)` 直线飞行。
- `assets/Script/Game/Bullet.js:12-38` `onCollisionEnter`：撞 `Box` 销毁；撞 `Ai` 发 `subHp`（扣怪血）并按 `hitTrue` 播爆炸；撞 `Player` 发 `playHpReduce` + `subHp`（扣主角血）。
- 减血统一走 `GameStart.js:124-152` `redunceHp()`：主角带护盾（`kaiguan`）时不掉血；对怪物读 `AiState` 判定并扣 `hp`，`hp<=0` 发 `hecai`（Praise 击杀计数）。

## 4. 敌人 AI（5 类 + Boss）

- `Monster1Control.js`（突袭者→Raider）：`speed=2` 追人，`<95px` 自爆（`SelfDetonate`）扣 20 血（`Monster1Control.js:82-123`）。
- `Monster2Control.js`（裂刃→Striker）：`speed=2` 追人，每 `AttackGap=3s` 发动冲刺攻击（`Monster2Control.js:97-160`）。
- `Monster3Control.js`（织网蛛→Weaver）：从顶部沿蛛丝下降，撞到主角发 `webPlayer` 困住 3 秒（`Monster3Control.js:39-50, 135-154`）。
- `Monster4Control.js`（飞梭→Shuttle）：一次性直线穿过屏幕（`Monster4Control.js:81-97`）。
- `AiControl.js`（通用基类）：`Walk/Stand/Attack` 状态机，`bornPosition()` 在屏幕外随机出生（`AiControl.js:30-42`）。
- Boss：`assets/Script/boss/Long.js`（与 jiqirenboss 同构）`hp=3000`，攻击方式 1 = 6 发 60° 激光扇形（`Long.js:74-95`），攻击方式 2 = 3 发贝塞尔炸弹（`Long.js:96-121`），死亡 `longDie` 分裂成 4 块爆炸（`GameStart.js:248-272`）。

## 5. 波次 / 关卡

- `assets/Script/Config/AiGencerCfg.js` 是唯一波次表：`{Wave, Mids, Amount, Time, Hp}`，`Mids` 是「波内敌型组合」（如 `"1-2-3"`），`Amount` 每波数量，`Time` 生成间隔，`Hp` 血量倍率。
- `AiGenerator.js:20-46` `createBoAi()` 读当前关 `Mids[boNum]`，按 `Amount` 数量 + `Time` 随机间隔 `scheduleOnce` 生成；`update()` 检测怪清空 → `boNum++` 下一波（`AiGenerator.js:96-117`）。

## 6. 卡牌 / 道具 / UI

- `assets/Script/Ui/Card.js`：翻牌三选一，随机给道具（子弹/火箭/火焰/冰冻/护盾/轰炸），`numByProps` 按道具类型给随机数量（`Card.js:73-93`）。
- `assets/Script/Praise.js`：`killNum` 计数，每 5 杀播一次喝彩动画 + 音效（`Praise.js:18-29`）。
- `assets/Script/Game/GameStart.js:169-226` 道具按钮：冰冻（全场冰住）、护盾（`kaiguan=true` 无敌）、火箭（轰炸）。

## 7. 改造映射（P0 还原 + 原创差异）

| 原作 | STAR SLAYER |
| --- | --- |
| WASD 移动 + 自动面向最近怪 | 同：`src/game/sim.js` `updatePlayer/updateAim` |
| 三种枪 hold-to-fire | J 主武器 hold-to-fire（自动瞄准） |
| 5 类敌人 + Boss | 同 5 类 + Boss（`config/levels.js` `ENEMY_TYPES`） |
| 波次表（关卡×波×数量×间隔×倍率） | 12 波 `config/levels.js` `WAVES` |
| 波间翻牌三选一给道具 | 波间技能卡三选一（规则型≥35%，`config/cards.js`） |
| 护盾/冰冻/火箭道具 | 护甲系统 + 超载协议 + 相位同步 |
| 无伙伴 | **光核**：跟随 + 复制攻击 0.5s 延迟（`CORE.COPY_DELAY`） |
| 洛斯大招（一次性） | **超载协议**：血量<30% 自爆光核清屏，光核离线 20s |

原创签名：**相位同步**（L 与光核换位 + 冲击波）、**协同复制提前量**（光核延迟 0.5s 复制你的攻击）、**超载协议**（血量<30% 自爆光核清屏，代价是伙伴离线）。三场景包：舰桥（蓝白）/舰体外壳（灰橙）/反应堆（青紫）。
