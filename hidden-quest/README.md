# HIDDEN QUEST · 寻物大师

场景寻物（Hidden Object）游戏。每关在杂乱场景中藏 5 个目标物（混在干扰物里），按右侧列表点击收集，找全过关。关卡越高干扰物越多。提示可圈出一个目标。

- 品类：找物 / 益智 / 休闲
- 参考：Hidden Objects（只借鉴品类，场景与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 场景 + DOM 目标列表 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/hidden-quest
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点击场景中的目标物收集；点错扣分。
- `H` 或「提示」按钮圈出一个未找到目标（每关 3 次）。
- `Esc` / `P` 暂停。

## 规则与计分

- 12 种物品图标；每关 5 个目标（各 1 个）+ 12→26 个干扰物（随关卡递增）。
- 找到 +50，点错 -10（不低于 0）；找全 5 个过关，最佳分存档。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（场景生成/不重叠/寻物/提示）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（布局/规则）/ objects（12 物品）/ locales / sdk.config
src/game/    sim.js（纯逻辑：场景生成/点击寻物/提示，可注入 seed）
src/render/  index.js（场景/12 种程序化图标/找到与提示反馈）
src/ui/      ui.js（标题/暂停/过关 + HUD + 目标列表缩略图 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.click(x,y)` / `debug.find(type)` / `debug.hint()` / `debug.next()` / `debug.solve()`。

## 国际化

仅 `en`（默认）+ `zh`；物品名与界面双语。