# SPACE WAVE 3D（太空波）

> 品类：arcade（单键穿行） · 平台：浏览器（桌面 + 移动） · 语言：默认英文 + 中文
> 一句话：**按住上升、松开下落，单键穿越霓虹管道躲开障碍，越窄的缝隙分越高。**

## G0 八问

1. **一句话**：玩家驾驶一艘自动前进的飞船，按住（空格/触屏）上升、松手下坠，穿过管道上一道道霓虹缝隙；贴缝中心=完美穿越，连穿倍率越叠越高，撞上障碍即结束。
2. **参考**：Space Waves 品类（CG 全站 #2）——只借鉴「单键躲障碍穿缝隙」的核心循环，程序化管道与美术全部自建。
3. **差异化**：① 3D 低多边形霓虹隧道 + 加性光晕（自写 sprite 模拟 bloom，零依赖）；② 连穿倍率 ×2…×8 的节奏系统，签名段「极限窄缝连穿 5 个、每次凝滞 0.2s、倍率炸到 ×8」；③ 每 500m 一个段（宽缝→移动柱→窄缝→加速旋转环→极限窄缝），每段一个新机制不是换色。
4. **操作**：桌面 = 空格 / 鼠标左键按住上升、松开下落，R 重开，Esc 暂停；触屏 = 按住屏幕任意位置上升、松开下落。3 秒可上手。
5. **一局**：30–120s；失败 = 撞障碍（有护盾则挡一次）；爽点在第 2 秒首次完美穿越、第 40 秒进入加速旋转段、签名段连穿。
6. **成长**：局内 = 连穿倍率（×1→×8）+ 护盾/能量球；跨局 = 最佳距离存档 + 评级（S/A/B/C）。
7. **结局**：撞障 = 结算卡（距离/完美穿越数/最高倍率/评级/新纪录）；一键重开 <1s。
8. **乐趣**：主 = mastery（掌控），副 = curiosity（好奇）。第 3 分钟想继续：为把连穿倍率推到 ×8 而反复挑战窄缝。第一个有代价的决定在第 6 秒：窄缝贪分 vs 宽缝求稳。

**签名记忆点**：极限窄缝连穿 5 个，时间每次凝滞 0.2s，倍率炸到 ×8，管道霓虹拉线。

**反范围（不做）**：联机、多键操控（纯单键）、飞船皮肤、剧情、关卡编辑。

## 运行

```bash
cd games/space-wave-3d
python3 -m http.server 8124   # 或直接用 playbook 的 shot/verify 脚本（自带服务）
```

## 数据契约

- **世界**：固定逻辑 1280×720，letterbox。纵向 `dist`（米）为前进轴，飞船在 z=0 平面，沿 y ∈ [-7, 7] 上下运动；隧道视觉半径 7.6m。
- **实体**：玩家 `{ y, vy }`；障碍门 `{ x, gapY, gapH, level, phase, kind, passed }`（kind ∈ ring/moving/narrow/spin/extreme）；能量球 `{ x, y, taken }`。
- **事件总线**（sim 发，render/audio/ui 消费）：`start / first_input / dist / pass / perfect / nearMiss / combo / orb / shield / segment / slowmo / fail / win / session_end`。
- **模块 API**：`createSim({seed}) → run`、`updateSim(run, {hold})`、`drainEvents(run)`、`getHud(run)`、`gateCenterY(gate,t)`、`ratingFor(score)`；`Render.render(run,dt)/onEvent/resize/dispose`；`UI.show* / updateHUD / popup / applyLang`；`Audio.unlock/setMuted/muted/play/event/setThrust`。
- **输入契约**：单键 `hold`（true=按住上升）。边沿不区分，`main.js` 统一把 空格 / 鼠标 / 触屏 归并为 `input.hold`；`window.__AUTO.hold` 供验收驱动。
- **状态机**：`title → playing → results`，外加 `paused`（Esc 切换）。`run.phase ∈ playing/dead/finished`，dead/finished 触发结算。
- **随机**：`mulberry32(seed)`，逻辑层不碰 `Date.now`/`Math.random`。

**5 行 smoke test**：

```js
const r = createSim({ seed: 1 }); updateSim(r, { hold: true }); getHud(r); drainEvents(r);
```

## 调试契约（`window.__ll`）

- `state.phase`（title/playing/paused/results）、`state.lang`/`dir`
- `start() / pause() / resume() / restart() / startAct()`
- `run`、`hud`、`tutorial`（`{ active, step, steps, current, skip }`）
- `demo.dead() / demo.finish()`（验收快速跳结算）
- `setInput({hold})`、`telemetry()`、`setLang(l)`

## 测试 / 验收

```bash
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 已知 TODO / 说明

- 美术为**程序化占位 + AI 素材已落盘**：天空 `assets/sky.jpg`、海报 `assets/poster-raw.jpg`、图标 `assets/icon-raw.png`、船体贴图 `assets/tex/hull.webp` 均已生成，但当前渲染只接线了 `sky.jpg`；船体贴图/海报/图标尚未接入玩法层（渲染预留了 `hull.webp` 槽位，Lead 后续美术升级时接线）。
- 音效全程序化 WebAudio；`assets/audio/bgm.mp3` 存在时会自动播放，缺失/解码失败回退 synthwave 琶音。
- 门禁脚本「0 外链」的唯二外部请求是 pipysdk 自身的平台配置轮询（`pipygames.com/sdk/config.json`、`/api/sdk/config`），属 SDK 行为非游戏资源；游戏资产/脚本/字体 100% 本地。verify-plan 因此沿用参考实现设 `external:false`，sdk-check 已单独豁免这两个 URL。

## 目录

```
index.html / styles.css          入口与样式
config/                          game.config / design.json / locales / sdk.config
src/core/                        i18n / save / sdk / audio
src/game/sim.js                  纯逻辑核心（单测覆盖）
src/render/index.js              Three.js 隧道渲染 + 光晕
src/ui/ui.js                     屏幕 / HUD / 首次交互引导
src/main.js                      装配 / 固定步长 / 事件分发 / __ll
src/vendor/pipysdk.js            平台 SDK（vendored，本地降级）
assets/                          AI 素材（sky/poster/icon/hull/bgm）
tests/                           node:test 纯逻辑
tools/                           selfplay / verify.plan / artgen / fun
```
