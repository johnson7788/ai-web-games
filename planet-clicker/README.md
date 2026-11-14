# PLANET CLICKER · 星球点击

太空题材点击放置（Idle Clicker）游戏。点击星球产生能量，购买点击力与自动产出设施（太阳能板/采矿无人机/聚变反应堆），累计能量达里程碑解锁新星球（地球→火星→木星→土星→海王星→太阳），每颗星球提供更高产出倍率。

- 品类：点击放置 / 增量（太空扩张）
- 参考：Planet Clicker 2（只借鉴品类，数值与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 星空/星球 + DOM 升级面板 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长放置

## 运行

```bash
cd games/planet-clicker
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点击星球产能（或按 `Space`）。
- 右侧面板购买升级；能量不足时按钮置灰。
- `Esc` / `P` 暂停；窗口失焦自动暂停并存档。

## 规则与计分

- 点击力 = `(1 + 点击等级) × 星球倍率`；自动产出 = `Σ(设施等级 × 速率) × 星球倍率`。
- 6 颗星球按累计能量解锁（1K/10K/100K/1M/10M），倍率 1/2/5/12/30/100。
- 升级成本 `base × growth^level` 递增；进度与最佳累计能量自动存档。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（点击/产出/星球解锁/存档）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（星球/升级/数值）/ locales / sdk.config
src/game/    sim.js（纯逻辑：点击/放置/星球解锁，可注入 seed）
src/render/  index.js（星空/星球/点击脉冲/粒子）
src/ui/      ui.js（标题/暂停 + HUD + DOM 升级面板 + 星球进度 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.click()` / `debug.buy(id)` / `debug.addEnergy(n)` / `debug.setPlanet(n)`。

## 国际化

仅 `en`（默认）+ `zh`；星球名与升级名双语。