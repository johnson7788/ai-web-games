# SAUCER STRIKE · 源码分析

> 参考 Cocos 源码 → 原创网页游戏。本文记录「玩法规则 1:1 还原」需要保留的事实，全部带 `文件:行号`。
> 原作素材/IP 一律不复用；角色/场景/音乐全原创。

## 1. 源码清单

### 1.1 打飞碟-creator（固定炮位射击飞碟波次）
路径 `/Users/admin/remake-src/打飞碟-creator/`

| 文件 | 职责 | 关键事实 |
| --- | --- | --- |
| `assets/Scripts/GameManager.ts` | 计分 / 胜负判定 | `EnemyCount=10`（`GameManager.ts:23`），`addScore()` 每杀一敌 `scoreCount += 100`（`GameManager.ts:41`），`EnemyCount -= 1`（`GameManager.ts:44`），`EnemyCount<=0` 时显示 win 屏并停 BGM（`GameManager.ts:60-65`） |
| `assets/Scripts/Player.ts` | 底部炮台 | 左右键移动 `speed=300*dt`、边界 ±315（`Player.ts:127-133`）；3 条命 `PlayerLife=3`（`Player.ts:26`）；空格发射（`Player.ts:49-59`，`schedule(bullets, 0.4, 1, 0)` 即 0.4s 一发）；血条 `fillRange-=0.3`（`Player.ts:96`）；敌弹命中 `PlayerLife-=1`（`Player.ts:90`） |
| `assets/Scripts/enemy.ts` | 飞碟移动 / 碰撞 | `enemyMovement()` = `moveBy(duration, -moveX, -moveY)` 接 `moveBy(duration, +moveX, -moveY)` 无限重复（`enemy.ts:36-40`），即 **Z 字 / V 字下坠路径**（`duration=0.5, moveX=200, moveY=75`，`enemy.ts:23-27`）；被玩家子弹（tag==3）命中 → 爆炸 + 计分（`enemy.ts:70-78`） |
| `assets/Scripts/bullet.ts` | 子弹 | 玩家子弹向上 `y += bulletSpeed*dt`（`bullet.ts:29`）；敌弹向下（`isEn_bullet` 分支，`bullet.ts:30-34`） |

**还原要点**：底部炮台 + 向上射弹、飞碟波次（Z 字路径）、命中计分、漏碟/敌弹扣命、清空全部敌人 = 过关。原作每杀一碟 +100、10 碟通关、3 命。

### 1.2 shoot（拉弓力度角度发射）
路径 `/Users/admin/remake-src/shoot/`

| 文件 | 职责 | 关键事实 |
| --- | --- | --- |
| `assets/scripts/Shoot.js` | 输入编排 | TOUCH_START 记起点 + 武器 `prepare()`（`Shoot.js:22-31`）；TOUCH_MOVE 更新终点 + `setForce(jsTouch.getForce())` + 旋转（`Shoot.js:33-42`）；TOUCH_END `weapon.fire()`（`Shoot.js:45-51`） |
| `assets/scripts/Touch.js` | 拖拽定角度力度 | `setStartPos` 记起点、线宽清零（`Touch.js:33-36`）；`setEndPos` 用 offset 算角度并限定 ±90°（`Touch.js:43-60`）；`getForce()` = `lineWidth/200` 封顶 1（`Touch.js:67-75`） |
| `assets/scripts/Weapon.js` | 蓄力 / 发射 | `MIN_ARROW=-3, MAX_ARROW=28`（`Weapon.js:30-31`）；`setForce(force)` 反向力拉弦（`Weapon.js:54-73`）；`fire()` 射箭（`Weapon.js:80-92`） |

**还原要点**：按住拖动 = 定角度 + 定力度（距离/200，封顶 1），松开发射。这就是「按住蓄力（拖动定角度力度）、松开发射」的机械原型。

## 2. 玩法规则还原映射（P0）

| 原作 | 本作规则 |
| --- | --- |
| 底部炮台（Player.ts） | 底部固定「磁轨炮」；按住拖动瞄准蓄力（shoot 机械），松开发射 |
| 飞碟波次 + Z 字路径（enemy.ts:36-40） | 12 波飞碟，含 Z 字、悬停、直掠、俯冲等路径（`config/levels.js`） |
| 命中按碟型计分（GameManager +100） | 碟型分：侦察碟 100 / 运输碟 300 / Z 字碟 200 / 隐形碟 400 / 母碟 1000 |
| 漏碟扣命（enemy 坠底 → loadScene） | 飞碟逃出屏幕 = 漏碟，扣 1 命（3 命起始） |
| 清空敌人 = 过关（GameManager:60） | 每波清空 → 下一波；12 波全清 = 通关 |
| 拉弓力度（shoot Touch.getForce） | 拖拽距离 = 力度 0..1；力度决定弹速/伤害；满蓄过热锁炮 |

## 3. 原创改造（不还原的部分）

- **磁轨过热**：力度 ≥ 阈值发射 → 锁炮 2s（低蓄速射 vs 高蓄险射）。
- **曳光弹**：每波 1 发；命中后 3s 内所有飞碟（含隐形碟）显形 + 轨迹可预判。
- **三场景包**：荒漠雷达站（沙黄）/ 极光基地（青绿）/ 城市天际线（蓝紫），换章换色板+构图+装饰。
- **签名瞬间**：满蓄命中母碟 → 光束撕裂夜空 + 雷达屏全网格闪红。
- **波内事件**：流星雨干扰（挡弹）。
- **原创碟型**：侦察碟（快）/ 运输碟（厚甲）/ Z 字碟 / 隐形碟 / 护航母碟群。

## 4. 结论

核心循环 = **拖磁轨炮蓄力 → 松开发射 → 命中计分 → 漏碟扣命 → 12 波递进**。机械原型直接继承 shoot 的「拖拽定角度力度」，波次与计分继承 打飞碟-creator 的「飞碟波次 + 命中计分 + 漏碟扣命」。玩法规则 1:1，视觉/角色/音频全部原创程序化。
