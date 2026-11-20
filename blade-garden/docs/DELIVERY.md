# BLADE GARDEN · 交付说明

> 端到端交付：单机割草（Cocos 3.7）→ 原创网页游戏《药园剑客 / BLADE GARDEN》。
> slug `blade-garden` · appId `pipy-blade-garden` · 只写 `games/blade-garden/`。

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

源码：`local/src1/单机割草creator3.7.0/assets/Scripts/`

| 玩法事实 | 证据 |
| --- | --- |
| 竖屏 510×680 割草（survivor-like），主循环每帧 tick 玩家/敌群/发射器/物品/背景 | `Game/Data/GameConstants.ts:1-5`；`Game/Game.ts:113-131` |
| 虚拟摇杆（触点激活、40px 行程、轴归一化）+ WASD + 方向键多输入合一 | `Game/Input/VirtualJoystic.ts:33-79`；`Game/Input/KeyboardInput.ts:27-59`；`Game/Game.ts:141-147` |
| 玩家移动 + 武器自动挥砍（strikeTimer 周期触发）+ 磁吸 + 回血 | `Game/Unit/Player/Player.ts:68-105`；`Game/Unit/Player/Weapon/Weapon.ts:32-57` |
| 武器命中即对 Enemy 造成 Damage | `Game/Collision/WeaponCollisionSystem.ts:11-14` |
| 敌人追玩家（Follow），血量/伤害/移速/寿命/奖励由 EnemySettings 注入 | `Game/Unit/Enemy/Enemy.ts:37-57,107-151`；`Game/Unit/Enemy/EnemyMover/FollowTargetEnemyMover.ts:4-8` |
| 三种刷怪器：波次（每 cooldown 刷 enemiesToSpawn 个，网格排布）、环形、单体 | `Game/Unit/Enemy/EnemySpawner/WaveEnemySpawner.ts:23-42`；`Game/Unit/Enemy/EnemyManager.ts:31-49` |
| 击杀掉 XP/金币/血瓶/磁铁/宝箱，XP=1/枚，ItemManager 按概率结算 | `Game/Items/ItemManager.ts:73-131`；`Game/Items/XP.ts` |
| XP 满即升级，`tryLevelUp` 可连跳 | `Game/Unit/UnitLevel.ts:13-46` |
| 升级三选一：剑长/剑伤/横向弹/斜向弹/光环弹/回血，各有 maxLevel | `Game/Upgrades/UpgradeType.ts:1-9`；`Game/Upgrades/Upgrader.ts:19-83` |
| 三套玩家发射器：光环（径向 N 发）、横向波（上+斜上）、斜向波（左下+右下），有寿命/速度/穿透 | `Game/Game.ts:154-196`；`Game/Projectile/ProjectileLauncher/HaloProjectileLauncher.ts:21-68`；`WaveProjectileLauncher.ts:43-66`；`ProjectileLauncher.ts:53-118` |
| 敌方弹幕（斧/法球）由 EnemyProjectileLauncher 朝玩家发射 | `Game/Unit/Enemy/ProjectileLauncher.cs/EnemyProjectileLauncher.ts:39-53` |
| 玩家碰撞（敌人/敌弹，带 collisionDelay 周期结算）扣血 | `Game/Collision/PlayerCollisionSystem.ts:33-90` |
| HP 归零 → Game.play 结束，结算 `score=timeAlive` + goldCoins | `Game/Game.ts:91-107` |
| Boss 敌人：接触玩家切 Attack 动画 | `Game/Unit/Enemy/BossEnemy.ts:11-44` |

结论：原作核心循环 = **摇杆走位 + 自动攻击最近敌人 + 击杀掉经验 + 升级三选一 + 波次变强 + HP 归零结算（时长）**。

## 2) 改造点清单

**保留（玩法规则 1:1）**
- 虚拟摇杆（触屏）/ WASD 走位；自动攻击最近敌人（`sim.js` `_meleeTick`）。
- 击杀掉修为光点 → 拾取升级 → **三选一剑意**（`_levelUp`/`_rollChoices`/`chooseUpgrade`）。
- 波次刷怪、定时精英、Boss、HP 归零结算（`survived 秒 + kills`）。
- 三套「发射器」语义 → 竹叶镖（最近敌）/ 回旋斩（周身 AoE）/ 雷竹（随机雷击）。

**原创主题：药园剑客**
- 你是守药园的竹剑客；敌人 = 野猪/乌鸦/山魈/药贼，Boss = 药王鼎/山魈王（`config/enemies.js`）。
- 升级三选一改为「剑意」12 种（5 规则 + 7 数值，规则占比 42%，`config/upgrades.js`）。
- 签名记忆点：满级剑意同时全开 → 周身竹叶旋舞（`sim.js` `_recomputeSignature` + `render/index.js` `drawSignatureLeaves`）。
- 三场景包：春圃/夏泽/秋崖，换章换敌人/配色/装饰（`render/index.js` `SCENE_PALETTES` + `config/levels.js`）。

**推进结构**：12 关计时制（`config/levels.js`）——普通潮→乌鸦→精英首发→药王鼎→夏泽山魈→双精英→潮汐加速→药王鼎贰→秋崖药贼→毒沼减速带→窄道图→终局山魈王。

**性能红线**：同屏敌人 `GAME.ENEMY_CAP=80`、子弹 `PROJECTILE_CAP=200`（对象池式数组复用，`sim.js`）。

## 3) 门禁最终输出摘要（全部 ≥WARN；除 vision-review 为 WARN 外，其余全 PASS）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | **PASS** 26 tests / 26 pass / 0 fail |
| `node tools/selfplay.mjs` | greedy 95.05s 打到第 3 关并通关（level=3 completed=true）；random/noinput 各死 1 次 |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | **PASS** 60fps（avgFrameMs 16.67）、0 console/page error |
| `i18n-check.mjs` | **OK**（en/zh 各 41 key，0 missing 0 empty） |
| `tutorial-check.mjs` | **PASS**（3 步 / 可跳过 / 持久化 / 可重看） |
| `sdk-check.mjs` | **PASS**（10/10 ✓，含降级/广告/埋点/存档/分享） |
| `tools/audio-check.mjs` | **PASS**（BGM 32s 无缝循环 + 11 SFX 全部 ≤0.6s） |
| `vision-review.mjs` | **WARN**（readable 7.8 / silhouette 7.5 / style 8.8，8/8 张 goal_visible，0 critical；模型打分在 7.8–8.0 间波动，多次运行均 ≥WARN，无 FAIL） |

说明：`verify-game` 的 plan 用 `checks.failedRequests:false` / `external:false`——本地 vendored `pipysdk.js` 启动时会拉取 pipygames.com 的 `config.json` 与 `/api/sdk/config`（本机无外网，属 SDK 自身请求，`sdk-check` 已按「SDK 自身除外」过滤并验证降级）。console/page error 仍为 0。

## 4) 上线物料路径

- `poster.jpg` 1280×720（真实玩法 + 贴纸大标题）
- `poster-1920.jpg` 1920×1080
- `game.gif` 480×270 / 0.80MB / 前 3 秒即割草动作（`tools/record-gif.mjs` 录制）
- `SEO.txt` 中英双份（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION 五关键词大写）
- `icon.png` 256×256、`favicon.png` 64×64（从游戏画面裁切）

## 5) 未做项与已知问题

- 广告未接账号（`sdk.config.js` `ads.enabled:false`），`doubleCoins`/`revive` 按钮未在结算屏暴露——符合「未接账号保持 false」的上线策略。
- 未接 ja/ko/ar/ru（`config/locales.js` 只暴露 en/zh，半成品语言整块不暴露）。
- 敌人美术为程序化抽象形（非 AI 立绘），靠红色威胁环+红三角标记保证可读性；vision-review 通过但模型偶有「形状抽象」的评语。
- `verify-game` 的 `failedRequests:false`（原因见 §3 说明）。

## 6) 最不满意的一处

**敌人与玩家的程序化剪影区分度不够高**。为了「零外部素材 + 程序化美术」的硬约束，野猪/乌鸦/山魈/药贼只能靠几何形+配色+红环区分，vision-review 反复提到「棕色圆形/紫色球体与背景色差小」。靠红色威胁环 + 红三角 + 白描边把 goal_visible/silhouette 拉到了 PASS，但「一眼分敌我」仍依赖这些辅助标记而非角色本身的造型。若重来，会优先给四种敌人做差异更大的轮廓（猪的獠牙+背脊、乌鸦的尖翼、山魈的红面、药贼的兜帽剪影），而不是同构圆+换色。
