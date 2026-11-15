# TOWER CLIMB · 霓虹塔攀

十层霓虹塔：缺口 / 移动平台 / 塌方块，摔下从头。第一人称平台跳跃，3D（three.js，零构建零外链）。

## G0 · 八问

1. **一句话**：你在十层螺旋霓虹塔上，靠跳跃 / 空中冲刺踩过缺口、移动平台与塌方块一路登顶；失足就俯冲 60 米摔回起点。
2. **参考**：hh-hang/three-player-controller（控制器思路，MIT）+ Celeste（coyote/buffer 手感）+ 霓虹跑酷审美。
3. **差异化**（为什么不是换皮）：① 失足 = 俯冲 60m 的签名坠落画面（相机下坠 + 风声 + 霓虹拉线）；② 5 层存档光环，摔落回 5 层而非重头；③ 7 层起侧风 + 风向标，把「贴内圈还是外圈」变成代价。
4. **操作**：桌面 WASD 移动 + 鼠标视角 + 空格跳 + Shift 空中冲刺 + R 回起点；触屏左摇杆 + 右滑视角 + A 跳 + B 冲。
5. **一局**：登顶约 1–3 分钟；失败条件 = 坠落（回存档层）；爽点在第 5 秒第一次跳过缺口，第 25 秒第一次空中冲刺抢平台。
6. **成长**：局内 = 无（纯技巧）；跨局 = 最佳用时存档 + S–C 评级。
7. **结局**：登顶 → 结算（总用时 / 坠落次数 / 评级 / 新纪录）；失败 = 坠落回存档层继续；重开一键回标题。
8. **乐趣**：主 = mastery（掌控），副 = curiosity（下一层是什么新机关）；第 3 分钟还想继续是因为「差一点就无坠落拿 S」。

**乐趣假设**：玩家会为「更少坠落、更高评级」反复重开。验证：bot 遥测 `fun-report` 的 `deathPresence` / `progressRate` / `firstSuccess`（G4.5 已 PASS）。

**签名记忆点**：从第 9 层失足，霓虹拉线中俯冲 60m 回底层，风声呼啸。

**反范围（不做）**：联机竞速 / 超过 10 层 / 角色自定义 / 剧情 / 关卡编辑器。

## 数据契约

- **世界 / 坐标 / 单位**：1280×720 逻辑视口 letterbox；3D 世界 Y 轴向上，单位米。塔：10 层 × 6m = 60m，螺旋半径 5m，每层转角 0.95rad。玩家用「脚底坐标」`(x, y, z)`；击杀面 `y < -14`。逻辑帧 60Hz（`STEP = 1/60`）。
- **实体字段**：`player = { x,y,z, vx,vy,vz, yaw,pitch, onGround, groundPlat, coyote, jumpBuffer, dashAvailable, dashT, peakY }`；`platform = { id, floor, kind, type, x,y,z, half, dx,dy,dz, crumble, crumbling, collapsed }`。
- **事件名**（sim 发，render/audio/ui 消费）：`start / first_input / jump / land / dash / level_up / checkpoint / crumble / fall / wind_gust / tick / won`。
- **模块 API**：`createSim({seed})` / `updateSim(run, input)` / `drainEvents(run)` / `getHud(run)` / `ratingFor(falls,time)`；`Render.render(run,dt)` / `Render.onEvent(ev)`；`UI.show*()`；`Audio.event(name)`。
- **输入契约**：`{ moveF, moveS, jump, dash, lookX, lookY, respawn }`；jump/dash 是**边沿**（main 由 `Input.hit()` + 触屏按钮给出），held vs pressed 归 `base3d.Input`。
- **状态机**：`title → playing → (paused ⇄ playing) → results → title`；`__ll.restart()` 回标题，`R` 键回存档层。

## 运行 / 验收

```bash
/opt/homebrew/bin/node --test                                  # 纯逻辑测试（22 条）
/opt/homebrew/bin/node tools/selfplay.mjs                      # bot 遥测 → tools/fun/autoplay.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```

## 已知 TODO / 简化

- **ja/ko/ar/ru 未翻译** → 整块不暴露（仅 en/zh），符合「不暴露半成品语言」铁律。
- 侧风只沿世界 X 轴（风向标 ◀/▶），未做随塔身切向的风场。
- 旋转平台是「绕中心公转」而非「自转」；塌方块无碎裂粒子（只有音效 + 闪烁 + 坍塌）。
- AI 素材只接入了 `assets/sky.jpg`（天空）；平台贴图 `assets/tex/platform.webp` 已预留槽位但当前用程序化霓虹边条（更符合低多边形风格）。BGM 已用 `assets/audio/bgm.mp3`，缺失回退 synthwave。
- 广告未接账号：`config/sdk.config.js` 的 `ads.enabled = false`，广告 UI 不出现，`showRewarded` 安全返回 false。
