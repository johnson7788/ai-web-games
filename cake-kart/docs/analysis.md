# CAKE KART · 源码分析（改造自「蛋糕飞车」Laya 3D 竞速）

> 源码路径：`/Users/admin/remake-src/蛋糕飞车laya/`（Laya 3D 卡丁车/滑板竞速 + 道具）。
> 本文件按共享执行单 v2 §1 要求，把「入口 → 主循环 → 输入 → 判定 → 关卡 → UI」的事实带 `文件:行号` 记录。

## 0. 结论：原作是「3D 下坡滑板竞速 + 道具 + 皮肤/广告平台壳」，不是圈速卡丁车

原作实际是 3D 纵向下坡滑行（角色沿 -Z 前进、贴轨道翻滚），核心是「加速/跳跃/撞障碍死亡/吃金币/道具」，带小程序平台（微信/头条/OPPO）广告与皮肤系统。spec 将其**重新定义为圈速竞速卡丁车**（3 圈 / 漂移蓄力 / 道具 / AI / 名次），因此本改造只还原「竞速 + 加速/漂移 + 道具 + AI + 名次」这一玩法骨架，全部美术/角色/赛道原创。

## 1. 入口

- `src/Main.ts:20-24`：按设备纵横比算 `_height`，`Laya3D.init(GameConfig.width, _height)`（`Main.ts:30-31`）；`src/GameConfig.ts` 存宽高/缩放模式。
- `src/Main.ts:45-66`：平台探测（`window.wx` / `window.tt` / `Laya.Browser.onPC`），PC 之外直接 `console.error` 返回（`Main.ts:66-69`）——原作强依赖小程序宿主。
- `src/scripts/LayaSample.ts`：全局单例（commonData / glEvent / storageMgr / wxMgr），业务事件走 `LayaSample.glEvent`。

## 2. 主循环与移动核心

- `src/scripts/JieExt/Game/SkaterMove.ts:550-604` `onUpdate()`：每帧 `u3dUpdate()`；速度渐进 `baseSpeed += 0.01`，硬核模式 `clamp 到 1.25`，普通 `clamp 到 1.0`（`SkaterMove.ts:578-590`）。
- `SkaterMove.ts:808-815` `allSpeed()`：`baseSpeed + (itemAddSpeed + (speedMul-1)*0.2) - itemSubSpeed*speedMul`，下限 `0.01` —— 加速档位（`speedMul`）与减速区（`itemSubSpeed`）是速度的加减项。
- `SkaterMove.ts:872-885` `ApplySpeedBuff()`：`speedMul++`，`clamp 到 4`，`maxtAddSpeed = 0.1 + speedMul*0.1` —— 原作「加速档位」→ 本作映射为「糖霜漂移三档 + 松手加速」。
- 转向：`SkaterMove.ts:726-758` `moveLeft/moveRight` 驱动 `angleAddSpeed = Lerp(..., ±25, ...)`；`SkaterMove.ts:1264-1271` 转向角 `clamp ±80`。
- 碰撞判定：`SkaterMove.ts:450-520` `OncollsionEnter` 按 `ShapeThreeD` 掩码分派——`AddSpped` 加速带、`SubSpeed` 减速带、`Box` 撞死（`Death()`）、`HunDun` 护盾、`CointItem` 金币、`JumpPlatform` 跳台。

## 3. 输入

- `src/scripts/JieExt/Game/SkaterMovePlayerCtrl.ts:80-118`：PC 下 `D/A` 映射 `moveLeft/moveRight`（**左右与直觉相反**，`PlayerCtrl.ts:81-82`）、`Space` 跳、`W` `ApplySpeedBuff()`、`X` 小跳。
- `SkaterMovePlayerCtrl.ts:141-194`：鼠标拖动横向位移累积 `MoveLRPower`（`clamp 0.5..5`），控制转向力度；上滑手势触发跳。
- 本作输入契约改为：←→ 转向、↑ 油门、Shift 漂移、空格道具（spec 规定），并配触屏按钮。

## 4. 判定（死亡 / 护盾 / 金币）

- `SkaterMove.ts:1558-1597` `Death()`：撞 `Box` 掩码触发，`GameMgrExt.instantce.playing=false`，`GameViewExt.instantc.OpenOver_Fail()` 弹失败结算。
- `SkaterMove.ts:1599-1620` `Boahu()`：护盾（`wudi=true` + 5s `closeWudi`），撞混沌道具 `HunDun` 也走护盾。
- `SkaterMove.ts:522-545` `onCollsionCoin()`：金币 +2（`tempaddGold += 2`）。
- 本作映射：**撞栏 → crash（deaths）**、**护盾 → shield 挡导弹/蛋糕**、**名次 → 完赛结算**。

## 5. 关卡 / 生成

- `src/scripts/JieExt/Game/LevelCreater.ts`：关卡/赛道生成器；`GameMgrExt.ts` 管理 `playing` / `playwin` / `hardModel`。
- `src/scripts/JieExt/Model/LevelData.ts`：关卡数据；`GameDesgin.ts`：设计常量（`zhujueWudi`、`npcUseEffect`、`MoveRPowerMulNum` 等）。
- 本作映射为 `config/tracks.js` 的 12 站 GP：赛道形状（弯道轮换 / 长直 / 泥区 / 窄桥）+ AI 速度递进 + 圈数 2→3。

## 6. 道具 / 技能

- `src/scripts/JieExt/Game/ItemCtrl/`：`XiangJiaoDiaoLuo.ts`（香蕉掉落）、`YingTao.ts`（樱桃）。
- `src/scripts/JieExt/SkillMgr/`：`SkillXiGuaDiaoLuo.ts`、`SkilYingTaoPao.ts`（技能掉落/炮弹）。
- 本作原创为「甜点武器」：樱桃导弹 / 威化护盾 / 果冻加速 / 蛋糕炸弹（糊对手屏幕 2s，AI 也会糊玩家）。

## 7. UI / 结算

- `src/scripts/views/`：`GameView.ts`（战斗 HUD + `goldItem`）、`OverView.ts` / `ClearingView.ts`（结算）、`HomeView.ts`（首页）、`SkinView.ts`、`ShopView.ts`、`RankView.ts`。
- 本作只保留：标题 / HUD（圈数·名次·速度·漂移三档·道具·圈进度·小地图）/ 暂停 / 完赛结算 / 设置，去掉皮肤/商店/签到/排行。

## 8. 反范围（本作明确不做，对齐 design.json）

真 3D 引擎、联网/排行榜、皮肤商店、每日任务、剧情对话。
