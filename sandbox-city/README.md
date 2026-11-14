# SANDBOX CITY · 沙盒城市

俯视角城市建造沙盒：铺路、建房、开店、种树，发展人口与收入。点击 / 拖动建造，7 种工具，无尽沙盒。

- 品类：模拟经营 / 沙盒（城市建造 / 经济）
- 参考：Sandbox City / 城市建造类（只借鉴品类，规则与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 俯视城市 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/sandbox-city
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 选工具：点击底部工具栏或数字键 `1-7`（道路/房屋/商店/公园/树木/水域/铲除）。
- 建造：点击格子；按住拖动可连续铺设（如道路）。
- `Esc`/`P` 暂停。

## 规则

- 26×13 网格；初始资金 $500。
- 房屋 +2 人口；商店 +$3/秒；人口纳税 $0.25/人/秒；每秒结算收入。
- 道路连通后自动生成车辆行驶（最多 10 辆）。
- 建造消耗资金，铲除免费清空；占用格需先铲除。
- 实时统计资金 / 人口 / 收入 / 已建；无尽沙盒，无失败。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（创建/建造/收入/占用/资金/铲除/经济/车辆/选择/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：10/10 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 24 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`sandbox-city-cover.png`），经 `tools/make-sandboxcity-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（网格/建筑/经济/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：建造/铲除/经济结算/车辆 AI/人口收入）
src/render/  index.js（城市网格/建筑/车辆/悬停高亮/工具栏/HUD）
src/ui/      ui.js（标题/暂停 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec)` / `debug.place(c,r,id)` / `debug.bulldoze(c,r)` / `debug.setMoney(n)` / `debug.select(i)`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。