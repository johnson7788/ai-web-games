# FARM RING · 农场环

环形农场挂机（Farm Ring Idle 式）。作物绕环生长，点击金色成熟作物收割金币；购买生长加速/价值/自动收割/新地块，解锁全部 12 块地。封面为 **AI 生成**原画。

- 品类：点击放置 / 模拟经营（环形农场）
- 参考：Farm Ring Idle（只借鉴品类，数值与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 环形农田 + DOM 升级面板 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长放置
- 美术：封面海报由 AI 生成（`tools/make-farm-poster.mjs` 合成），游戏内图标程序化。

## 运行

```bash
cd games/farm-ring
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点击成熟（金色）作物收割。
- 右侧面板购买升级；「新地块」解锁环上下一块地。
- `Esc`/`P` 暂停；窗口失焦自动暂停并存档。

## 规则与计分

- 12 块地，初始 4 块；作物基础 6 秒成熟，价值 5 金币。
- 生长升级 ×0.85 时间/级；价值 +50%/级；自动收割成熟作物；地块解锁至 12。
- 进度与最佳收割数自动存档。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（生长/收割/自动/解锁/存档）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（环/升级/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：生长/收割/升级，固定步长 tick）
src/render/  index.js（环形地块/作物生长/成熟脉冲/粒子）
src/ui/      ui.js（标题/暂停 + HUD + DOM 升级面板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.harvest(i)` / `debug.buy(id)` / `debug.addCoins(n)` / `debug.grow(sec)` / `debug.ripen()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。