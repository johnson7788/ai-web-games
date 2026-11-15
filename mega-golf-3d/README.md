# MEGA GOLF 3D（巨型高尔夫）—— 立项、设计源与接口契约

> 日期：2026-11-15 · 品类：3D 迷你高尔夫 · 平台：浏览器（桌面 + 移动）
> 语言：默认**英文**（en），**中文**（zh）必做；ja/ko/ar/ru 未翻译整块不暴露
> 代码在 games/mega-golf-3d/，纯静态、零构建、零运行期外链（唯一例外站点 pipysdk，可降级）

## 0. 一句话
玩家在 24 洞低多边形迷你高尔夫场里，拖拽瞄准（反向拉=方向+力度）、松手推杆，
在风力、坡地与机关（风车/弹板/移动门/沙坑/水障）的干扰下把球送进洞，用最少的杆数通关拿评级。

**主乐趣**：掌控（mastery）；**副乐趣**：好奇（curiosity）。
**乐趣假设**：第 3 分钟玩家还想继续，是因为「读坡/判风 → 预判弹道 → 一杆进洞」的掌控感在每洞递增，
且洞沿擦边（near-miss）与一杆进洞的庆祝反馈不断给「再来一杆」。G0.5 验证：bot greedy 全 24 洞 122s 通关、首胜 5s、12 种事件。
**核心动词（3）**：aim（瞄准，代价=风/坡偏转）/ putt（推杆，代价=力度过大冲出果岭）/ read（读坡，代价=判错多杆）；aim+putt 组合出弹道。
**第一个「有代价的决定」**：第 8 秒，直攻洞口 vs 绕开坡地（坡会拐弯）。

**签名记忆点**：球在洞口边缘缓缓转一整圈，悬念拉满后掉进洞，旗帜弹跳庆祝。

**反范围（这版不做）**：联机、超过 24 洞、球杆系统（只推杆）、剧情、球场编辑器。

## 1. 核心循环
- 秒级：拖拽瞄准 → 松手击球 → 球滚动（受坡/风/机关）→ 进洞/停球/入水。
- 局级：24 洞杆数累计 → 每洞结算（小鸟/鹰/帕/柏忌/爆杆）→ 总杆 vs 总 par 评级。
- 长线：最佳总杆、累计一杆进洞数存档；每日挑战洞（date seed）。

**3 分钟循环（教-练-变-收）**：教 30s（1–6 平地基础）→ 练 45s（7–12 坡地）→ 变 30s（13–18 风）→ 收 15s（19–24 机关/复合）。

## 2. 操作
### 2.1 桌面
| 动作 | 键位/鼠标 |
| --- | --- |
| 拖拽瞄准（反向） | 鼠标左键拖拽 |
| 松手击球 | 松开左键 |
| 缩放视角 | 滚轮 |
| 旋转视角 | 右键拖拽 |
| 重打（+1 杆回开球点） | R |
| 暂停/继续 | Esc / P |

### 2.2 触屏
单指拖拽瞄准松手击球；双指捏合缩放 + 旋转视角；按钮/触区 ≥44px 不遮 HUD。

### 2.3 输入契约
held vs pressed 边沿检测归 main；拖拽屏幕向量 → 世界 XZ 反向方向（相机右/前基）→ run.aim {dirX, dirZ, power}；power=拖拽长度/POWER_DRAG_LEN 截断 [0,1]。

## 3. 数据契约
- **世界/单位**：果岭 X∈[0,64]、Z∈[0,42]（世界单位），地面 y=0，球半径 0.5；逻辑帧 1/60；HUD 逻辑视口 1280×720（letterbox）。
- **实体**：`run.ball { x, y, z, vx, vz }`（cannon-es Sphere 镜像）；`run.hole`（config/holes.js 的洞对象）。
- **事件**（谁发=sim，谁消费=render/audio/ui/main）：
  `start / shot {hole,strokes,power} / roll {x,z} / stop {x,z} / sand / windmill_hit / gate_block / bounce / near_miss / capture / penalty {reason} / hole {hole,strokes,par,result} / busted / level_clear {hole} / finished {total,par,rating}`。
- **模块 API**：`createRun({seed,holeIndex}) / step(run,dt) / shoot(run,{dirX,dirZ,power}) / resetShot(run) / solveAim(run) / predict(run,dirX,dirZ,power,sec) / drainEvents(run) / getHud(run)`；
  `Render.render(run,dt)`；`UI.showTitle/showGame/showPause/hidePause/showResults/updateHUD`；`Audio.event(name)`。
- **状态机**：屏幕 `title → playing → paused → results → title`；sim 子相位 `aim → roll → capture → finished`（爆杆/进洞推进下一洞）。

**5 行 smoke test**：
```js
const r = createRun({ holeIndex: 0 });
shoot(r, solveAim(r)); step(r, 1/60); getHud(r); drainEvents(r);
```

## 4. 技术
- 零构建纯静态（index.html + ESM）；lib/three.module.js + lib/cannon-es.js vendor，零运行期外链。
- 物理：cannon-es 球体（重力+地面接触+弹性墙碰撞）；坡地重力分量/风/滚动摩擦为代码施加的力；机关/水障/洞判定全部代码（判定几何/碰撞/命中全部代码）。
- config-first：数值在 config/game.config.js，24 洞几何在 config/holes.js，SDK 在 config/sdk.config.js。
- SDK 统一出口 src/core/sdk.js（本地 vendored mock，零外链；上线 source 切 'online'）。
- 存档只经 Sdk.save/load；i18n 默认英文 + 中文。

## 5. 已知 TODO（WARN 项对账）
- 移动端竖屏只给「请横屏」提示，未做竖屏专用 HUD 布局（fun-audit 无 WARN，此项为主动预留）。
- AI 美术（天空/贴图/海报）仅预留贴图槽位，当前为程序化渲染（Lead 并行生成中，接线 agent 后续替换）。
- 每日挑战洞已按 date seed 选洞，但未做独立变体几何（当前复用 24 洞之一）。
