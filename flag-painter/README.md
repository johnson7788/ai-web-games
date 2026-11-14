# FLAG PAINTER · 国旗猜猜

涂国旗地理问答（Paint the Flag 式）。给出国家名与空白国旗，选颜色涂满每条色带，点检查校验；全对得分并进入下一面。16 面条纹旗（竖条/横条），无计时，寓教于乐。

- 品类：问答 / 益智 / 教育（国旗地理）
- 参考：Paint the Flag（只借鉴品类，题库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 国旗 + DOM 调色板 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/flag-painter
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点调色板选色（或按 `1–7`），再点国旗色带上色。
- `Check`/`Enter` 校验；错误色带标红叉，可修正后重查。`Clear` 清空。
- 全对后点 `Next`/`Enter` 进入下一面。`Esc`/`P` 暂停。

## 规则

- 16 面国旗随机顺序；每面 +100 分；涂完全部即通关。最佳分存档。

## 测试与验收

```bash
node --test                                                   # 9 条纯逻辑测试（涂色/校验/通关/题库完整性）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（布局/调色板）/ flags（16 面国旗）/ locales / sdk.config
src/game/    sim.js（纯逻辑：涂色/校验/计分/顺序）
src/render/  index.js（国旗色带/编号/错误标记）
src/ui/      ui.js（标题/暂停/完成 + HUD + 调色板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|done；`start/pause/resume/restart`；
`debug.state()` / `debug.select(color)` / `debug.paint(i)` / `debug.check()` / `debug.next()` / `debug.solve()` / `debug.solveAll()`。

## 国际化

仅 `en`（默认）+ `zh`；国家名与界面双语。