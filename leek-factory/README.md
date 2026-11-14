# LEEK FACTORY · 工厂大亨

工厂流水线放置（Idle Factory）游戏。种植→加工→打包三站产线生产大葱并出售赚金币；产线速度取决于最慢的工位（瓶颈，红色高亮）。手动收割大葱、升级各站速率与品牌（单价），打造大葱帝国。

- 品类：点击放置 / 模拟经营（工厂流水线）
- 参考：Leek Factory Tycoon（只借鉴品类，数值与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 传送带 + DOM 升级面板 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长放置

## 运行

```bash
cd games/leek-factory
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点击大蔥收割（或按 `Space`）， instantly 得一捆金币。
- 右侧面板升级三站速率与品牌；瓶颈站红色标记。
- `Esc` / `P` 暂停；窗口失焦自动暂停并存档。

## 规则与计分

- 各站速率 = `等级 × 基础速率`（Grow 1.0 / Process 0.8 / Pack 0.6）。
- 产线吞吐 = 三站速率最小值（瓶颈）；金币/秒 = 吞吐 × 单价。
- 品牌每级 +1 金币/棵；手动收割 +5 棵 × 单价。
- 升级成本 `base × growth^level` 递增；进度自动存档（每 5 秒 + 暂停/失焦/关闭）。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（瓶颈/吞吐/经济/存档）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（三站/升级/数值）/ locales / sdk.config
src/game/    sim.js（纯逻辑：瓶颈吞吐/收割/升级经济，可注入 seed）
src/render/  index.js（传送带/三站机器/流动大葱/收割按钮）
src/ui/      ui.js（标题/暂停 + HUD + DOM 升级面板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.harvest()` / `debug.buy(id)` / `debug.addCoins(n)` / `debug.setLevel(id,n)`。

## 国际化

仅 `en`（默认）+ `zh`；站名与升级名双语。