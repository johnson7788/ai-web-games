# CRUSHER · 粉碎机

点击放置（Idle Clicker）游戏。点击矿石粉碎它赚金币，购买「粉碎力 / 自动粉碎机 / 暴击」升级，一路突破 8 种材料（岩石→铜→铁→银→金→翡翠→红宝石→钻石）。自动粉碎机离线也在产出。

- 品类：点击放置 / 增量（Clicker / Idle）
- 参考：Crusher Clicker（只借鉴品类，数值与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 2D + DOM 升级面板 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长放置

## 运行

```bash
cd games/crusher
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点击矿石粉碎（或按 `Space`）。
- 右侧面板购买升级；金币不足时按钮置灰。
- `Esc` / `P` 暂停；窗口失焦自动暂停并存档。

## 规则与计分

- 每次点击造成 `1 + 粉碎力等级` 伤害；暴击率 `5%/级`（上限 50%），暴击 ×3。
- 自动粉碎机：`2/级` 每秒伤害（放置产出）。
- 粉碎一个矿石得该材料价值金币；每 10 个升一阶，材料更硬更值钱。
- 升级成本按 `base × growth^level` 递增；进度自动存档（每 5 秒 + 暂停/失焦/关闭）。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（经济/放置/升阶/存档）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（材料/升级/数值）/ locales / sdk.config
src/game/    sim.js（纯逻辑：点击/放置/升级经济/升阶，可注入 seed）
src/render/  index.js（多面矿石开裂/血条/破碎粒子）
src/ui/      ui.js（标题/暂停 + HUD + DOM 升级面板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.click()` / `debug.buy(id)` / `debug.addCoins(n)` / `debug.crush()` / `debug.setTier(n)`。

## 国际化

仅 `en`（默认）+ `zh`；材料名与升级名双语。