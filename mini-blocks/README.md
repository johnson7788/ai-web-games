# MINI BLOCKS · 迷你方块

第一人称 3D 体素沙盒（Minecraft / Bloxd.io 风格）：程序生成方块世界，挖掘 / 放置方块，自由探索建造。**纯 Canvas 2D 软件体素渲染**，60fps。

- 品类：沙盒 / 模拟（3D 体素 / 挖掘建造 / 第一人称）
- 参考：Miniblox / Bloxd.io / Minecraft（只借鉴品类，渲染与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 软件 3D（面投影 + 画家算法 + 雾效）· 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/mini-blocks
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点击画面锁定鼠标；`WASD` 移动，鼠标转向，`空格` 跳跃。
- 挖掘：左键（按住，按硬度破坏）；放置：右键。
- 快捷栏：数字键 `1-6`（泥土/石头/木头/树叶/沙子/砖块）。
- `Esc`/`P` 暂停（释放鼠标）。

## 规则

- 32×24×32 体素世界：地表草/沙、下泥土/石头、随机树；每局种子生成。
- 第一人称物理：重力 / AABB 体素碰撞 / 跳跃；视线光线步进（reach 6）选目标方块。
- 渲染：仅绘制邻接空气的可见面，背面剔除 + 远到近排序 + 距离雾；绘制距离 7 格。
- 挖掘掉落入库（草→泥土）；放置消耗库存且不能与玩家重叠。
- 统计已挖 / 已放；无尽沙盒，无失败。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（创建/地形/移动/跳跃/碰撞/挖掘/放置/视线/选择/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：10/10 测试通过 · 浏览器验收 pass（**60fps**，0 console 错误）· i18n en/zh 各 21 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`mini-blocks-cover.png`），经 `tools/make-miniblocks-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（世界尺寸/方块/玩家/渲染）/ locales / sdk.config
src/game/    sim.js（纯逻辑：地形生成/第一人称物理/体素碰撞/光线步进/挖掘/放置）
src/render/  index.js（软件 3D 体素渲染：面投影/画家算法/雾效/天空/目标框/快捷栏）
src/ui/      ui.js（标题/暂停 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.look(yaw,pitch)` / `debug.teleport(x,y,z)` / `debug.mine()` / `debug.setInv(id,n)` / `debug.select(i)`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。