# MOTO DASH 3D（摩托穿流）

第一人称穿车流：180 km/h 在 4 车道高速上穿梭，擦身 30 厘米加分，**一次撞击就结束**。

## G0 · 八问

1. **一句话**：玩家在第一人称摩托上，在无限直路车流里变道穿梭，贴车 30cm 内擦身拿分并叠连击；一次撞击即结算。
2. **参考**：victorgalvez56/redline（MIT，车流思路）；只借品类，不抄素材/角色/UI。
3. **差异化**（3 条）：① 第一人称摩托穿流（同类多为第三人称赛车）；② 擦身 30cm 精确判定 + 3s 连击 ×2×3…；③ 一命制（一次撞击结束）+ 无限直路跑分，高压下逼出「贴还是不贴」的连续取舍。
4. **操作**：桌面 A/D 或 ←/→ 变道、W/S 油门/刹车、空格氮气、R 重开、Esc 暂停；触屏 左半屏滑动转向、右下长按油门、氮气按钮（≥44px 不遮 HUD）。
5. **一局**：60–180s；失败 = 撞击（慢镜头回放 1.5s 后结算）；爽点在第 ~10s 第一次贴车擦身、第 ~35s 跑过 500m 检查点。
6. **成长**：局内 = 连击节奏 + 氮气充放；跨局 = 最佳距离 / 最高连击存档。
7. **结局**：撞击 → 慢镜头 1.5s → 结算卡（距离 / 擦身数 / 最高连击 / 评级 S–D）→ 一键重开；新纪录有「NEW RECORD」庆祝。
8. **乐趣**：主 = mastery（掌控），副 = curiosity；第 3 分钟玩家想再冲一次纪录；第一个有代价的决定在第 ~6s（贴车擦身拿分 vs 拉开安全距离）。

- **乐趣假设**：核心决定「贴 30cm 拿分 vs 拉开保命」在前 6s 就出现，且失败代价（一命）足够痛 → 玩家会反复重开冲纪录。验证方式 = `fun-audit`（结构）+ `fun-report`（bot 遥测：首胜 ≤60s、推进 ≥1000m、≥50% run 死过）。
- **签名记忆点**：以 180km/h 从两辆卡车 30cm 缝隙中穿过，时间凝滞 0.3s 弹出 `NEAR MISS ×4`。
- **反范围（不做）**：联机 / 摩托改装 / 弯道赛道（纯直路）/ 警察追逐 / 剧情。
- **美术来源**：低多边形程序化占位渲染（色板：沥青灰 #2b2f36 + 天空蓝 #7ec8e3 + 警示红 #ef4444 + 摩托橙 #ff7a1a）；AI 素材（assets/sky.jpg、tex/road.webp、tex/cockpit.webp、audio/bgm.mp3）已生成待接线，`src/render/index.js` 顶部留贴图槽位。

## 数据契约

- **世界/坐标/单位**：无限直路，4 车道 × 3.6m，车道中心 x = `[-5.4,-1.8,1.8,5.4]`（左 2 对向、右 2 同向）；道路半宽 7.2m，摩托横向可动 ±6.6m；单位米/秒，60Hz 固定步长（`STEP=1/60`），逻辑帧与渲染帧解耦。渲染把 sim 的「前方 +z」映射为 three 的 `-z`。
- **实体字段**：
  - `player`：`{ x, speed, distance, nitro, boosting, lane, steer }`
  - `traffic[i]`：`{ lane, dir(1 同向/-1 对向), x, z(前方距离, +为前), speed, hw, len, isTruck, nearMissed, passed, color }`
- **事件名**（sim 发、render/audio/ui 各自消费）：`start / lane / oncoming / overtake / nearMiss{bonus,combo} / combo{n} / boost / boostEnd / nitro-ready / wind / checkpoint{n,m} / segment{name} / crash{reason} / gameover`。
- **模块 API**：`createSim({seed})` / `updateSim(sim, input)` / `getHud(sim)` / `drainEvents(sim)` / `crashNow(sim)` / `ratingFor(distance)`。
- **输入契约**：`{ steer:-1..1, throttle:bool, brake:bool, nitro:bool }`；held vs pressed 边沿在 `main.js` 处理。
- **状态机**：`title → playing ⇄ paused`；`playing → (crash) → results → title/playing`；sim 内 `phase: running → crashed → over`。

## 运行 / 验收

```bash
cd moto-dash-3d
python3 -m http.server 8124            # 打开 http://127.0.0.1:8124/
/opt/homebrew/bin/node --test          # 18 条纯逻辑测试
/opt/homebrew/bin/node tools/selfplay.mjs                          # 写 tools/fun/autoplay.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 已知 TODO（诚实列出）

1. **AI 贴图未接线**：`assets/sky.jpg / tex/road.webp / tex/cockpit.webp` 已生成，但当前为纯程序化占位渲染（AI 出图偏暗，直接贴会黑成一片，需 assetprep 提亮后再接）；贴图槽位在 `src/render/index.js` 顶部注释。
2. **BGM**：`assets/audio/bgm.mp3` 已生成并接线（缺失回退程序化 synthwave）；若需替换成正式配乐，直接覆盖文件即可。
3. **触屏刹车**：触屏只做「转向 + 油门 + 氮气」（按执行单 §3），未做触屏刹车键（桌面 S 有）。
4. **无 `win` 结算**：本作无通关（无限跑分，一命制），SDK 漏斗 `fail` 由每次撞击触发，`win` 仅在新纪录时埋点。

## 目录

```
config/          数值/文案/设计源（design.json / game.config.js / locales.js / sdk.config.js）
src/core/        base3d（共享底座）/ i18n / save / sdk / audio + src/vendor/pipysdk.js（本地验收桩）
src/game/sim.js  纯逻辑（可 node --test）
src/render/      3D 渲染
src/ui/          UI/HUD/教学
src/main.js      装配 / 固定步长 / 状态机 / __ll 调试口
tools/           selfplay.mjs / verify.plan.json / artgen
tests/           纯逻辑测试 + final 截图
```

## 调试契约

`window.__ll`：`state.phase`（title/playing/paused/results）、`start/pause/resume/restart/crash/setInput`、`tutorial`、`run/hud/save/ui/lang/setLang`。`window.G`：`{ Game, UI, Render, Audio, Save }`。
