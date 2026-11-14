# MINE EMPIRE · 矿业帝国

矿业挂机（Idle Mining）游戏。点击矿井向下挖，越深的矿层越值钱（泥土→煤矿→铁矿→金矿→钻石）。挖掘赚钱，购买镐头（点击力）/钻机（自动挖掘）/精炼厂（收益倍率），打造矿业帝国。

- 品类：点击放置 / 模拟经营（矿业挂机）
- 参考：Idle Mining Empire / Mr. Mine（只借鉴品类，数值与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 矿井剖面 + DOM 升级面板 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长放置

## 运行

```bash
cd games/mine-empire
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点击矿井挖掘（或按 `Space`）。
- 右侧面板购买升级；资金不足时按钮置灰。
- `Esc` / `P` 暂停；窗口失焦自动暂停并存档。

## 规则与计分

- 点击力 = `1 + 镐头等级` 米/次；钻机 = `2 × 等级` 米/秒；精炼厂 = `1 + 0.5 × 等级` 收益倍率。
- 5 矿层按深度（50/200/500/1000 米）解锁，每米价值 1/3/8/20/50。
- 收益 = 挖掘米数 × 当前层价值 × 精炼倍率；进度与最佳累计收益自动存档。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（挖掘/矿层/挂机/升级/存档）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（矿层/升级/数值）/ locales / sdk.config
src/game/    sim.js（纯逻辑：挖掘/矿层价值/升级经济，可注入 seed）
src/render/  index.js（矿井剖面/掘进面/碎石粒子）
src/ui/      ui.js（标题/暂停 + HUD + DOM 升级面板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.dig()` / `debug.buy(id)` / `debug.addMoney(n)` / `debug.setDepth(d)`。

## 国际化

仅 `en`（默认）+ `zh`；矿层名与升级名双语。