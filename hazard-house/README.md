# HAZARD HOUSE · 陷阱屋

本地 1–4 人派对生存：在陷阱屋里躲开闪烁的尖刺格与定时炸弹，活到最后赢得回合，先赢 **3 回合**夺冠。空位由 bot 补位。

- 品类：多人派对 / 街机（陷阱生存 / 同屏对战）
- 参考：House of Hazards（只借鉴品类，规则与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 竞技场 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/hazard-house
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- P1：`WASD`（单人时也可用方向键）
- P2：方向键 · P3：`IJKL` · P4：`TFGH`
- 标题屏选 1P–4P（其余为 bot）；`Esc`/`P` 暂停。

## 规则

- 4 名角色各 3 颗心；受击掉 1 心 + 1.2s 无敌帧；心尽出局。
- 尖刺格：先红闪预警 0.9s，再激活 0.7s，站在上面掉血。
- 炸弹：锁定某玩家位置，黄圈预警 1.1s 后爆炸（半径 92）。
- 陷阱随回合时间越来越密；仅剩一人时该回合结束并记分。
- 先赢 3 回合夺冠；bot 会寻找安全点躲避。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（倒计时/移动/尖刺/炸弹/无敌/淘汰/回合/夺冠/bot自跑/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：11/11 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 24 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`hazard-house-cover.png`），经 `tools/make-hazard-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（竞技场/网格/玩家/陷阱/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：移动/尖刺/炸弹/伤害/无敌/bot AI/回合/夺冠）
src/render/  index.js（竞技场/陷阱预警与激活/角色/血条/HUD/回合覆盖层）
src/ui/      ui.js（标题含 1–4P 选择/暂停/冠军 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,inputs)` / `debug.setHumans(n)` / `debug.setScores(arr)` / `debug.killAllBut(id)` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。