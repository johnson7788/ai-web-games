# BLAZE FPS（烈焰突袭）— 立项、设计源与接口契约

> 日期：2026-11-14 · 品类：action（第一人称射击）· 平台：浏览器（桌面 + 移动）
> 语言：默认英文（en）+ 中文（zh）；ja/ko/ar/ru 未做，整块不暴露。
> 参考：mshumer/Claude-of-Duty（武器手感/敌人 AI 模块思路）+ mohsenheydari/three-fps（指针锁定骨架）；本地参考 games/front-wars 的波次数据。
> 代码在 games/blaze-fps/，纯静态、零构建、零运行期外链（唯一例外 pipysdk，缺失降级可玩）。

## 0. 一句话
玩家被困在烈焰仓库，用 3 把枪打退一波波冲来的敌人，用爆头慢镜和后坐力手感在 3 张图里杀到屋顶 Boss。

**主乐趣**：mastery（掌控）；**副乐趣**：curiosity（好奇）
**乐趣假设**：第 3 分钟玩家还想继续，是因为「波间三选一升级」在不断改写法术 build，且爆头慢镜这一瞬间的反馈足够爽。G0.5 验证方式：`fun-audit` 结构审计 + `fun-report` bot 遥测（首胜/推进率/死亡存在性）。
**核心动词（≤3）**：shoot（代价=弹药+后坐力抬枪口）/ dash（代价=体力，冲刺中不能射击）/ reload（代价=换弹 1.6s 无防备）
**第一个有代价的决定**：第 8 秒「先打冲锋兵还是远处射手」。
**签名记忆点**：爆头瞬间时间凝滞，子弹轨迹拉出火线，敌人布偶式后仰。

**反范围（这版不做）**：联机 / 超过 3 图 / 剧情战役 / 枪械改装树 / 排行榜服务端。

## 1. 核心循环
- 秒级：移动 → 瞄准 → 开枪（后坐力抬枪口）→ 冲刺/换弹/切枪。
- 局级：一波敌人 → 波间三选一升级 → 下一波。
- 长线：3 图 × 5 波 → 屋顶 Boss → 胜利结算 → 最高击杀评级。

**3 分钟循环**：教 30s（仓库图冲锋兵）→ 练 45s（射手登场）→ 变 30s（自爆兵/掩体）→ 收 15s（Boss + 结算）。

## 2. 操作
### 桌面
| 动作 | 键 |
| --- | --- |
| 移动 | WASD |
| 视角 | 鼠标（指针锁定） |
| 射击 | 左键 |
| 瞄准 | 右键（FOV 收窄） |
| 冲刺 | Shift |
| 换弹 | R |
| 切枪 | 1/2/3 |
| 暂停 | Esc |

### 触屏
左下虚拟摇杆移动 · 屏幕右侧滑屏视角 · 射击/瞄准/冲刺/换弹按钮（≥44px）· 1/2/3 切枪。

### 输入契约
main.js 收集键鼠/触屏 → 每逻辑帧拼成 `input = { forward, strafe, yaw, pitch, fire, aim, sprint, reload, switchTo }`；边沿（reload/switch）在 main 归边；sim 只读 held + 绝对 yaw/pitch。

## 3. 玩法与数值
### 3.1 枪械（config/game.config.js WEAPONS）
| 枪 | 弹匣/备弹 | 伤害 | 射速 | 散布 | 特色 |
| --- | --- | --- | --- | --- | --- |
| 步枪 | 30/120 | 18 | 10/s | 低 | 全自动主力 |
| 霰弹 | 6/36 | 11×8 弹丸 | 1.4/s | 高 | 近战扇形 |
| 手枪 | 12/∞ | 15 | 6/s | 低 | 备用无限 |

爆头 ×2.5 伤害 + 0.4s 慢镜（timeScale 0.22）。

### 3.2 敌人
| 敌人 | 行为 | 出场 |
| --- | --- | --- |
| 冲锋兵（橙锥） | 直线逼近 + 近战 | 全图 |
| 射手（红方） | 保持距离射击 | 第 2 波起 |
| 自爆兵（黄球） | 近身 1.5s 引信引爆 | 第 3 波起 |
| Boss（暗红重甲） | 重甲 + 近战 + 召唤小怪 | 每图第 5 波 |

### 3.3 升级（12：6 规则 + 6 数值）
规则：穿透 / 爆炸弹 / 吸血 / 爆头凝滞延长 / 冲刺冲击 / 跳弹；数值：伤害 / 备弹 / 换弹 / 生命 / 移速 / 体力回复。

### 3.4 玩家
100HP，脱战 5s 后 7HP/s 回血；死亡=本波重开（保留升级）；3 图全通=胜利结算。

## 4. 技术架构
- 零构建纯静态：`index.html` + ES Module；1280×720 letterbox + 60Hz 固定步长。
- `window.G` 单命名空间 + `window.__ll` 标准调试口（state.phase / start / pause / resume / restart / startAct / tutorial / demo / telemetry）。
- config-first：数值/文案/地图布局在 `config/*`；`src/game/sim.js` 纯逻辑（不碰 DOM/window/localStorage/Date.now，随机用 seed）。
- 事件总线：sim 发事件，render/audio/ui 各自消费。
- SDK 统一出口：`src/core/sdk.js` + `config/sdk.config.js`（域名锁/广告/埋点/存档/分享），本地 vendored mock（`src/vendor/pipysdk.js`），缺失降级可玩。

### 4.1 数据契约
```js
createRun({ seed }) -> run          // run: { phase, waveState, time, player, enemies, bullets, enemyBullets, upgrades, bonuses, stats, score, events, ... }
updateSim(run, input)               // 1/60 固定步长
drainEvents(run) -> Event[]         // { type, x?, y?, z?, dmg?, kind?, wave?, map?, t, ... }
getHud(run) -> hud                  // { hp, ammo, weapon, wave, mapId, kills, recoil, hurt, slowmoT, upgradeChoices, ... }
applyUpgrade(run, id)               // 波间三选一
```

### 4.2 实体字段
- 玩家：`{ x, z, yaw, pitch, hp, maxHp, weapon, ammo{}, reserve{}, energy, sprinting }`（y 固定 eyeY=1.7）。
- 敌人：`{ id, kind, x, z, yaw, hp, maxHp, speed, radius, height, color, score, ... }`。
- 子弹：`{ x,y,z, dx,dy,dz, dmg, speed, life, pierce, aoe, ricochet }`。

### 4.3 事件名
`shot / hit / kill / headshot / slowmo / explosion / enemyShot / melee / playerHurt / reload / weapon / outOfAmmo / impact / waveStart / waveClear / waveIntro / upgrade / upgradeTaken / bossSpawn / bossSummon / dead / victory / dashBlast / exploderDie`

### 4.4 状态机
`title → playing( wave → upgrade → wave … → victory → results )`；`playing ⇄ paused`；死亡不切屏（本波重开）。

## 5. 验收
```bash
cd games/blaze-fps
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```

## 6. 已知 TODO
1. 掩体不可破坏（design.json 提到「掩体破坏」，本版只做碰撞/阻挡，未做可击碎掩体）。
2. Boss「冲撞」简化为高伤近战 + 召唤（未做独立冲刺动作）。
3. AI 素材（天空/贴图/BGM）已接入，海报/图标原画留待上线物料流程。
4. 触屏移动使用左侧半屏隐形摇杆 + 右下按钮（无独立可见摇杆轨道动画）。
