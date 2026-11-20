# 源码分析 — carnival-shot

> 参考实现：打鸭子（`/Users/admin/remake-src/打鸭子creator/`）+ 打靶游戏（`/Users/admin/remake-src/打靶游戏-creator/`）
> 原则：玩法规则 1:1 还原，角色/场景/音乐全原创（夜市猎鸭庙会主题）。禁止复用原作素材/IP 名。

## 一、打鸭子（BirdManager / birdControl）

- **入口→主循环**：`assets/script/BirdManager.ts:25-58`。`start()` 里注册 `callback`，用 `this.schedule(callback, 1)` 每 1 秒生成一只鸟。
- **生成**：`BirdManager.ts:32-37` 每次 `instantiate(this.birdPre)`，`bird.x = Math.random()*1100-550`（随机横向 -550~550），`bird.y = this.node.y`，调用 `birdControl.fly()`。
- **得分**：`BirdManager.ts:39-43` 命中回调 `addScoreCallback = () => { this.score += 100; scoreLabel.string = ... }`。每只 +100。
- **失败/返回**：`BirdManager.ts:45-52` 鸟飞出屏幕 `dieCallBack` → `destroyAllChildren()` + 显示返回按钮 + 取消计时器。
- **鸟飞行（核心运动）**：`birdControl.ts:28-46` `fly()`：`targetpos = v2(random*1100-550, maxy=1060)`，按目标 x 相对当前 x 翻转精灵朝向；`tween(this.node).to(4, {position: targetpos})`，4 秒飞到屏幕顶；`call(() => dieCallBack())`。
- **命中判定（点击）**：`birdControl.ts:49-64` `_touch()`（`Node.EventType.MOUSE_DOWN`）：播放 die 动画 → 停止飞行 tween → tween 下落到 `y=0`（1s）→ `node.destroy()` → `addScoreCallback()`。命中即销毁+计分，无弹匣概念。
- **开始**：`startControl.ts:14-16` `startGame()` → `director.loadScene("game")`。

**可复用的规则**：计时生成目标；目标横向随机出生、向固定高度飞行（4s 生命周期）；点击命中即销毁+计分；飞出屏幕即失败结算。

## 二、打靶游戏（Bullet / Target / Magazine / Cannon / Common / ResultDialog）

- **弹匣（限量弹）**：`Magazine.ts:21-39` `capacity=10`、`count=10`；`onLoad` 生成 10 个子弹图标；`reset()` 回满、`consume(n)` 扣弹并 clamp ≥0、`display()` 用 active 显示剩余弹数。
- **子弹飞行+命中**：`Bullet.ts:39-57` 每 0.016s 前进 `speed=15`；`y>400` 时判定 `isHit()`（`distance = |target.x - bullet.x| < 50`，只看 x 方向）；命中 → `success()`（+10 分、爆炸特效、音效），脱靶 → `failed()`（直接销毁）。
- **靶子运动**：`Target.ts:22-32` 左右横移 `dx=3`，在 `x=-200..200` 之间反弹（`isLeft` 翻转）。
- **开火**：`Cannon.ts:91-140` `fire()`：炮口角度 → 单位方向向量，生成子弹（起始位置 r=120），`Common.magazine.consume(1)`，播放发射音效。
- **共享状态**：`Common.ts:17-34` `static score`、`static magazine`、`static resultDialog`；`resetGame()` 清零分数+重置弹匣。
- **结算**：`ResultDialog.ts:28-50` `show()` 显示最终得分；`onReplay()` 关闭并 `Common.resetGame()`。弹匣打空即 `dismiss()` 触发结算（`Bullet.ts:63-67`）。

**可复用的规则**：弹匣限量+打空自动结算；目标左右横移；点击（炮塔拖拽开火）→ 子弹飞向目标 → 命中判定（x 向阈值）→ 命中/脱靶两种结果；结算后可重玩。

## 三、合并后的还原映射（carnival-shot）

| 原作行为 | 本作落点 |
| --- | --- |
| 计时生成目标（1s/只） | 关卡内按 `config/levels.js` 的生成间隔持续产目标 |
| 鸟横飞 4s、飞出即失败 | 目标有生命周期，飞出屏幕不计分（不触发失败，改由时限结算） |
| 点击命中 +100（鸭子）/ +10（靶） | 不同目标不同分值（纸鸢/提灯鸭/金鸭/移动靶分值不同） |
| 脱靶不得分 | 打空枪（无目标命中）→ combo 清零，不计分 |
| 弹匣限量（10 发）打空结算 | 弹匣 6 发，打空自动换弹 1.2s（本作原创：主动换弹 R 换速装匣） |
| 靶子左右横移反弹 | 移动靶（靶纸）左右横移弹出 |
| 连续命中 | 连续命中连击加成（本作原创：combo ×8 触发孔明灯雨） |
| 时限/结算 | 12 关限时关卡，时间到按目标分判定过关/失败 |

## 四、本作原创改造（与 spec 对齐）

1. **换弹节奏（signature 机制）**：弹匣 6 发；`R` 主动换弹保留余弹并装「速装匣」，下次换弹时长减半（1.2s → 0.6s）。
2. **风灯奖励鸭**：每关 3 只红灯鸭，命中触发轮盘小游戏（双倍 / 加时 / 满弹）。
3. **连击 ×8 孔明灯雨**：全场金光 + 奖励分。
4. **三场景包**：灯会（暖红，1–4 关）/ 河灯（青蓝，5–8 关）/ 烟花夜（金紫，9–12 关）。
5. **12 关推进**：每关目标分 + 目标行为轮换（快飞 / 俯冲 / 成群 / 小鬼灯假目标 / 移动靶 / 限时金鸭…）。
