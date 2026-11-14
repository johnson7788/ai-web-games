# COLOR TAP · 数字填色

按数字填色（Color by Number）休闲游戏。选一个编号颜色，点相同编号的格子上色，填满整幅画即完成。6 幅像素画（爱心/星星/蘑菇/花朵/小鱼/火箭）。无计时、无失败，纯放松。

- 品类：填色 / 休闲 / 艺术
- 参考：Color Tap: Coloring by Numbers（只借鉴品类，图库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 网格 + DOM 调色板 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/color-tap
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点调色板色块选色（或按 `1–9`），再点网格中相同编号的格子上色。
- 选中色会高亮所有匹配格；色块显示剩余格数；填完一色自动切下一色。
- `H` 或「提示」按钮自动填一格（每幅 5 次）。`Esc`/`P` 暂停。

## 规则

- 6 幅 16×16 像素画，每格编号对应一种颜色；背景格（0）不可填。
- 填满所有可填格即完成；完成数存档。

## 测试与验收

```bash
node --test                                                   # 9 条纯逻辑测试（含图库完整性校验）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（布局/调色板）/ pictures（6 幅图库）/ locales / sdk.config
src/game/    sim.js（纯逻辑：选色/填色/提示/完成）
src/render/  index.js（编号网格/已填色/选中高亮）
src/ui/      ui.js（标题/暂停/完成 + HUD + DOM 调色板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|complete；`start/pause/resume/restart`；
`debug.state()` / `debug.select(color)` / `debug.tap(r,c)` / `debug.hint()` / `debug.solve()` / `debug.setPicture(n)`。

## 国际化

仅 `en`（默认）+ `zh`；画作名与界面双语。