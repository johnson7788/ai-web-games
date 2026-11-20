# 源码分析 — Pal2.0 仙剑奇侠 → SWORD SAGA

> 源路径：`/Users/admin/remake-src/Pal2-0仙剑奇侠/`（Cocos Creator + TypeScript，2018 版本）
> 结论：玩法规则 1:1 还原（回合战斗 / 地图行走 / NPC 对话 / 剧情节点 / Boss），IP 全原创化。

## 入口与场景

- `assets/Script/StartMenu/StartMenu.ts`：开始菜单（未细读，仅确认存在）。
- `assets/Script/LoadScene/LoadScene.ts`：场景加载；`QM.game.map` 决定加载哪个地图（`QM/QM.ts:240`）。
- `assets/Scene/战场.fire` / `Map.fire`：战斗与地图两个主场景。

## 回合战斗（P0 核心）

- `assets/Script/Battle/BattleManager.ts`：
  - `onLoad` 注册 `RoleEnd` → `run`（`:24`），`run()` 轮换当前行动角色（`:38-86`）。
  - 玩家回合显示功能条 `this.func.active = true`（`:71`）；敌人回合隐藏功能条并自动 `attack`（`:73-79`）。
  - `readyAttack()` 设置 `action='attack'` 进入选目标态（`:88-92`）；`ClickRole()` 分发攻击（`:94-107`）。
- `assets/Script/Battle/Role.ts`：角色基类——血条/蓝条（QBar）、`SubHpTip` 减血飘字（`:56-71`）、`RoleEnd` 事件（`:74-79`）。
- `assets/Script/Battle/Hero.ts`：我方攻击分三档概率——普攻 60% / 二连击 30% / 蓄力 10%（`:26-41`）；攻击位移动画（`:52-91`）。
- `assets/Script/Battle/Enemy.ts`：敌方 `camp="enemy"`（`:6`），攻击/受击动画镜像（`:13-57`）。

> 原作用「轮换 + 随机目标」而非真正的速度条；spec 明确 P0 要求「速度条出手顺序」，故本作改为 ATB 速度条（身法=速度）。

## 角色属性与五行

- `QM/QM.ts:147-205`：`QM.Player` 属性含 `hp/mp/physical(武术)/magic(灵力)/defense/bodylaw(身法)/luck(吉运)`。
- `QM/Db.ts:12-18`：`Db.Attr` 枚举 `fire(火)/wood(木)/water(水)` 等五行属性（原作只实现部分）。
- 本作补齐完整五行相克环：金→木→土→水→火→金。

## 地图行走 / NPC / 剧情

- `assets/Script/Map/MapManager.ts`：解析地图数据 `parseMapDat()`（`:111-133`），初始化玩家/NPC/军团/门/物品；`findPoint/findPath/findDoor`（`:254-282`）。
- `assets/Script/Map/Player.ts`：八方向移动（`:100-186`），随从跟随（`:114-126`）。
- `assets/Script/Map/Npc.ts`：NPC 巡场 `TourMove`（`:192-223`），点击触发剧情（`:156-189`）。
- `assets/Script/Map/PlotManager.ts`：剧情解释器——`dialog/move/director/dat` 四类节点（`:50-71`）；对话（`:113-115`）、转场（`:117-125`）、数据指令 task/npc/door/pack（`:128-170`）。
- `QM/Db.ts:352-459`：`Db.Plot` 数据结构（对话/移动/导演/数据）。

## 数据模型

- `QM/Db.ts:47-341`：物品表（武器/帽子/披风/衣服/佩戴/鞋/剧情/药品/投掷/辅助）。
- `QM/Db.ts:493-580`：敌人表（`Db.Enemy`：hp/physical/magic/defense/bodylaw）。
- `QM/game.ts`（在 `QM.ts` 内）：全局单例 `QM.game` 保存队伍/背包/任务/地图数据（`:226-499`）。

## 本作落地对照

| 原作 | 本作 |
| --- | --- |
| 轮换回合 | ATB 速度条（身法） |
| 普攻三档随机 | 普攻 + 技能 + 道具 + 防御 |
| 五行部分实现 | 完整五行相克 ×1.5 / 同属 ×0.75 |
| 单一主角 | 双主角（云隐 + 灵狐，战斗中换人） |
| —（原创） | 灵狐替身（挡致命一击，2 回合离场） |
| —（原创） | 剑意蓄势（防御蓄势，下回合技能 ×2） |
| —（原创） | 五行克制命中全屏墨晕（signature） |
| 杭州城等原作地图 | 青竹林 / 雪山道 / 锁妖塔 三场景包 |
| 王小虎等原作人物 | 云隐剑歌原创剧情（12 章） |
