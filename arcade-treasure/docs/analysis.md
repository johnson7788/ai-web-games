# 源码分析：H5电玩白鹭-java → ARCADE TREASURE

> 源码根：`/Users/admin/remake-src/H5电玩白鹭-java/H5电玩/`（Egret 白鹭 H5 引擎，TypeScript，298 个 js 子玩法 + Java 后端）。
> 结论：这是一套**电玩城大厅（联网/牌桌/捕鱼）平台**，不是单机小游戏集合。可单机化的子玩法只有「捕鱼」一类射击/接金币玩法；牌类（百家乐/百人牛牛/斗地主）属赌博，不做规则还原，只借鉴其「大厅 → 房间 → 桌台」的**代币串玩框架**。
> 按 spec 要求：只花 30 分钟定位子玩法与大厅代币流，不深挖联网/支付。

## 1. 入口与大厅流程（代币串玩框架）

- 入口 `h5-client/src/Main.ts:104-107`：`onPreLoadComplete()` → `LoginMgr.start()`，先登录再进大厅。
- 大厅流程：`Login → Home(大厅) → Room(选游戏房间) → Table(桌台) → Game(子玩法)`。
- `game/module/Home/HomeManager.ts:136-139`：`resEnterGameHall()` 成功后 `App.ViewManager.open(ViewConst.Room, gameTitle)`——**大厅 → 房间选游戏**。
- `HomeManager.ts:81-99`：`reqEnterCurGame(gameid)` / `reqEnterCurGameRoom(roomid)` / `reqQuickEnterCurGame(roomid)`——**选游戏 → 进房 → 快速入桌**的串玩入口。
- 货币：`HomeManager.ts:165-168` 座位信息带 `gold / cedit / chips`（金币/积分/筹码），即「代币」多币种模型。

## 2. 子玩法盘点（`src/game/games/` 与后端 `service/games/`）

| 子玩法 | 客户端目录 | 后端目录 | 可否单机化 |
| --- | --- | --- | --- |
| 金蟾捕鱼（jcby / fish） | `games/fish/` | `service/games/jcby/` | ✅ 射击/接金币，可单机 |
| 百家乐（baccarat） | `games/baccarat/` | `service/games/baccarat/` | ❌ 赌博牌桌 |
| 百人牛牛（brnn） | `games/brnn/` | `service/games/bairenniuniu/` | ❌ 赌博牌桌 |
| 斗地主（ddz） | （后端 `service/games/ddz/`，客户端未见独立目录） | `service/games/ddz/` | ❌ 多人牌局 |

结论：**只有「捕鱼」是可单机化的街机玩法**，其余为联网赌博牌桌。spec 的 P0 因此采用「捕鱼=接金币」的射击-接取核心循环为还原锚点，牌桌框架（大厅/房间/入桌）转译成「三台街机 + 代币串玩」的原创大厅。

## 3. 捕鱼（接金币）核心循环 —— 本作「雨中拾荒」的还原锚点

- 编排器 `games/fish/FishMgr.ts:43-75`：`FishManager`（鱼）、`BulletManager`（子弹）、`CollisionManager`（碰撞）、`FishGoldManager`（飞行金币）、`BatteryManager`（炮台）、`SkillManager`（技能）——**瞄准 → 发射 → 碰撞 → 得分/金币**五件套。
- 鱼被击中的死亡结算 `common/Fish.ts:150-168`：死亡特效 → `FishLabelManager.play(..., fishScore)`（飘分）→ `MusicManager.play(死亡音效)` → `SkillManager.play(技能)`。
- 金币飞向玩家 `common/Fish.ts:170-180`：`deadEffEndCall()` 把 `{startPos, angle, number: fishScore, endPos}` 交给 `FishGoldManager.play(info)`——**得分以金币形式飞向玩家**（本作代币回收的视觉原型）。
- 分数写入 `common/Fish.ts:453-454`：`setFishScore(score)`。
- 金币飞行速度 `common/FishGold.ts:91`：`dis / FishMgr.Config.System['gold_move_v']`——配置驱动的飞行时长。

## 4. 转译映射（源码 → ARCADE TREASURE）

| 源码 | 本作原创机台 |
| --- | --- |
| 大厅 Home → 房间 Room → 桌台（代币 gold/cedit/chips） | 复古街机厅大厅，三台街机，代币串玩 |
| 捕鱼：瞄准 → 发射 → 碰撞 → 金币飞回 | 雨中拾荒（接金币）：移筐接落下的金币/避雷击 |
| 牌桌「入桌-下注-结算」节奏 | 机房守夜（打地鼠）、像素蜂群（小蜜蜂）补充两台原创机台 |
| 金币回收飞向玩家（FishGoldManager） | 成绩换币：得分飞回代币袋（自续杯经济） |

## 5. 不深挖的部分（spec 前置要求）

- 联网协议（`core/net/*`、`protobuf/`、`FishReq.ts` 的 socket 注册）不做。
- 支付/兑换（`ExchangeView.ts`、`SetView.ts`）不做。
- 角色换装/大厅皮肤（`resource/skins/*`、`resource/assets/game/*`）不复制，美术全程序化原创。

## 6. 结论

本作 = **源码的「大厅 + 代币串玩 + 接金币循环」骨架**，套上 spec 指定三台原创街机（机房守夜 / 雨中拾荒 / 像素蜂群）+ 代币经济学（门票 1 币、成绩换币、自续杯）+ 连机热度（×1.2/×1.5）+ 12 段厅段位 + 三台全通「GRAND PRIX」霓虹亮灯签名瞬间。
