# ARENA 8

> 8 人布偶死斗：1 真人 + 7 bot 补位，最后存活者获胜。

## 运行

```bash
cd arena-8
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键（桌面） | 触屏 |
| --- | --- | --- |
| 移动 | WASD | 左摇杆 |
| 视角 | 鼠标拖拽 | 右侧滑动 |
| 拳 | J | 拳按钮 |
| 抓 / 扔 | K | 抓按钮 |
| 大招（震地，CD 12s） | L | 大招按钮 |
| 暂停 | Esc | — |

## G0 八问

1. **一句话**：8 人在紫色圆形竞技场里布偶互殴，拳 / 抓扔 / 震地，把对手扔出场外或打空血，最后存活者赢下锦标赛。
2. **参考**：品类借鉴 `paw-brawl`（布偶互殴表现）+ `three-fps`（3D 骨架）；不抄素材/角色/UI。
3. **差异化**：① 抓举扔出场外 = 秒杀且是唯一签名画面（布偶空中四肢乱舞）；② 武器三属性 × 抓扔 × 震地的三角决策（球棒伤害 / 平底锅击退 / 拳套攻速）；③ 5 场锦标赛 + 场间规则型升级（build 差异），非纯数值。
4. **操作**：键鼠 WASD + J/K/L + 鼠标视角；触屏左摇杆 + 右滑 + 三按钮（≥44px，不遮 HUD）。3 秒看懂。
5. **一局**：单场 3 分钟（超时按 HP 排名）；5 场锦标赛。失败 = HP 归零或被扔出场外。爽点在第 8–40 秒（第一次拳击命中 / 第一次抓扔）。
6. **成长**：局内 = 场间三选一升级（8 种，5 规则 + 3 数值）；跨局 = 最佳分 / 击杀 / 连胜 / 评级存档。
7. **结局**：夺冠（CHAMPION! 评级 S–C）或淘汰（ELIMINATED），结算卡带最佳击杀数 + 一键重开。
8. **乐趣**：mastery（布偶物理手感）+ social（多人混战决策）。第 3 分钟还想继续：升级 build 成型 + 差一点冲评级。第一个有代价的决定在第 8 秒（先打最近的还是先捡武器）。

- **乐趣假设**：玩家会在第 3 分钟继续，因为「抓扔出场外」有掌控快感、场间规则型升级产生 build 期待；G0.5 用 `fun-audit`（结构）+ G4.5 用 `fun-report --auto`（bot 遥测）验证。
- **签名记忆点**：抓住对手布偶举过头顶扔出场外，布偶在空中四肢乱舞飞出场。
- **反范围（不做）**：真联机（7 bot 补位，联机留接口）、超过 1 张图、角色解锁树、剧情、排位。
- **美术来源**：AI 出图（天空/地板/海报，`tools/artgen/plan.json`）+ 程序化低多边形布偶/竞技场/粒子/霓虹边线；AI BGM（`assets/audio/bgm.mp3`，缺失回退程序化合成）。

## 数据契约

- **世界/单位**：逻辑视口 1280×720 letterbox；圆形竞技场半径 `ARENA.R=26`，y 轴向上，地面 y=0；60Hz 固定步长（`STEP=1/60`）；第三人称追踪相机（`CAMERA`）。
- **实体字段**（`run.fighters[i]`）：`id / isPlayer / colorIdx / x / z / y / vx / vz / vy / facing / hp / maxHp / alive / gone / ragdollT / airborne / punchCd / grabCd / ultCd / weapon / weaponDur / grabbing / grabbedBy / grabHold / lastHitBy`。武器 `run.weapons[i]`：`type / x / z / respawnT`。
- **事件名**（`run.events`，sim 发、render/audio/ui 消费）：`start / matchStart / punch / hit / kill / fall / grab / throw / weaponPickup / weaponBreak / ult / matchEnd / upgrade / win / lose`。
- **模块 API**：`createSim(opts)` / `updateSim(run, input, dt)` / `drainEvents(run)` / `getHud(run)` / `pickUpgrade(run, id)` / `ratingFor(score)`。
- **输入契约**：`{ mx, mz, punch, grab, ult }`（mx/mz 为世界空间移动方向；punch/grab/ult 由冷却门控，边沿由 main 的 `pressed` 集提供）。
- **状态机**：`title → playing(run.phase: match|upgrade) → paused → results → title`；`run.phase` 终态 `won|lost`。

## 已知 TODO（WARN 级，G7 对账）

- 视觉评审 `vision-review` 对「教学跳过后的闲置对局截图」判 `goal_visible=false`（混战目标=7 名对手，开局瞬间远离相机），主截图（标题/手机/教学首帧）均 r8–9/s6–7 通过；非 §5 门禁命令。
- 触屏「右滑视角」为拖拽式，未做指针锁定惯性。
- 联机仅留 `Sdk` 出口，协议未实现（本批不做）。

## 目录

```
index.html / styles.css   入口与样式（#stage 1280×720 letterbox）
config/                   design.json + game.config.js + locales.js + sdk.config.js
src/game/sim.js           纯逻辑（战斗/AI/锦标赛/升级）
src/render/index.js       3D 渲染（布偶/竞技场/武器/粒子）
src/ui/ui.js              屏幕/HUD/教学/升级
src/core/                 i18n / save / audio / sdk / base3d
src/vendor/pipysdk.js     vendored 站点 SDK
tools/                    selfplay / verify.plan / fun
tests/                    纯逻辑测试 + final 验收证据
```
