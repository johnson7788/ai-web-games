# CITY BUS · 城市公交

俯视角公交驾驶：在 90 秒班次内，把车停进黄色站点接上候车乘客，再停到他们发蓝光的目的地送达赚车费。路线规划 + 精准停车 + 时间管理。

- 品类：模拟经营 / 驾驶（公交 / 接客）
- 参考：City Bus Driver（只借鉴品类，物理与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 俯视城市 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/city-bus
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 油门 / 刹车：`W/S` 或 `↑/↓`；转向：`A/D` 或 `←/→`。
- 移动端：屏下 ◀▶ 转向 / 刹车 / 油门(大) 触控按钮。
- `Esc`/`P` 暂停。

## 规则

- 3 纵 3 横道路网，建筑为实心障碍（撞上减速），巴士有惯性 / 转向随速度变化。
- 8 个站点；停稳（速度 < 26）在站点区域内 0.35s 触发上下客。
- 候车乘客有目的地（蓝色脉冲光圈 + 车头方向箭头）；上车容量 4。
- 送达收车费（按路程 10–20）；候车耐心 30s，超时离开。
- 班次 90s，结束结算现金与送达数；最佳班次存档。

## 测试与验收

```bash
node --test                                                   # 12 条纯逻辑测试（道路/加速/转向/碰撞/生成/上下客/容量/耐心/班次/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：12/12 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 27 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`city-bus-cover.png`），经 `tools/make-citybus-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（路网/巴士/站点/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：巴士物理/建筑碰撞/乘客生成/上下客/车费/耐心/班次）
src/render/  index.js（俯视城市/道路/建筑/公园/站点/巴士/HUD/浮动提示）
src/ui/      ui.js（标题/暂停/结算 + 触控 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.teleport(x,y,heading)` / `debug.spawn(origin,dest)` / `debug.setMoney(m)` / `debug.endShift()` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。