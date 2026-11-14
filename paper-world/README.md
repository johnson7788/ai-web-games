# PAPER WORLD · 纸片世界

2D 挖掘建造沙盒（Paper Minecraft / Terraria 风格）：程序生成方块世界，挖方块、攒资源、自由建造。昼夜循环，无尽沙盒。

- 品类：沙盒 / 休闲（挖掘 / 建造 / 2D）
- 参考：Paper Minecraft / Terraria（只借鉴品类，规则与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 方块世界 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/paper-world
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 移动：`A/D`（或方向键）；跳跃：`W/↑/空格`。
- 挖掘：按住左键（范围内方块，按硬度计时破坏）。
- 放置：右键（空气格，消耗所选方块）。
- 快捷栏：数字键 `1-5` 选方块（泥土/石头/木头/树叶/煤炭）。
- `Esc`/`P` 暂停。

## 规则

- 40×22 方块世界：地表草、下泥土/石头（含煤）、随机树与沙地；每局种子生成。
- 玩家有重力 / 单向方块碰撞；挖掘距离 4.5 格。
- 方块硬度不同（草 0.4s / 石 0.9s / 煤 1.0s）；破坏掉落对应资源入库。
- 放置不能与玩家身体重叠；昼夜 60s 一轮。
- 统计已挖 / 已放；无尽沙盒，无失败。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（创建/地形/移动/跳跃/碰撞/挖掘/放置/范围/选择/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：10/10 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 22 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`paper-world-cover.png`），经 `tools/make-paperworld-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（网格/方块/玩家/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：地形生成/玩家物理/挖掘/放置/库存/昼夜）
src/render/  index.js（昼夜天空/方块/玩家/挖掘裂纹/目标高亮/快捷栏/HUD）
src/ui/      ui.js（标题/暂停 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.mine(c,r)` / `debug.place(c,r,id)` / `debug.setInv(id,n)` / `debug.select(i)`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。