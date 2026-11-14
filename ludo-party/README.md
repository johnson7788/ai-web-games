# LUDO PARTY · 飞行棋

经典飞行棋（Ludo King 式），玩家（红）对战 AI（蓝），各 4 子。掷 6 起飞，绕棋盘进入 home 通道到中心；落在对手棋子上将其撞回基地；掷 6 再掷一次；四子全到终点获胜。

- 品类：棋牌 / 休闲（飞行棋）
- 参考：Ludo King / Ludo Club（只借鉴品类，规则实现与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 棋盘 + DOM 骰子面板 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/ludo-party
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 你的回合：点「掷骰子」（或 `Space`）；可动棋子高亮，点选（或按 `1-4`）移动。
- AI 回合自动进行。`Esc`/`P` 暂停。

## 规则

- 52 格主跑道 + 各 6 格 home 通道；progress 57 完成。
- 掷 6 才能出库（起飞到跑道 0）；掷 6 获额外回合。
- 落在非安全格的对手棋子上将其撞回基地；起点为安全格。
- 到终点需恰好点数；四子全完成获胜；胜场存档。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（起飞/移动/撞回/到家/胜负/AI 自对弈）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（玩家/规则/配色）/ locales / sdk.config
src/game/    sim.js（纯逻辑：骰子/走子/撞回/AI，可注入 seed）
src/render/  index.js（方形跑道/基地/home 列/中心/棋子）
src/ui/      ui.js（标题/暂停/胜利 + 骰子面板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.roll()` / `debug.move(i)` / `debug.ai()` / `debug.setDice(d)` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。