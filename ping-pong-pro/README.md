# PING PONG PRO · 乒乓对战

俯视角乒乓球对战（玩家 vs AI）。移动球拍把球打过对方得分，每次击球球速加快，先得 7 分获胜。球按击中球拍的位置反弹角度。

- 品类：体育 / 街机（乒乓 / Pong）
- 参考：Table Tennis World Tour（只借鉴品类，物理与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 球桌 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长物理

## 运行

```bash
cd games/ping-pong-pro
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：滑动移动球拍；键盘 `A/D` 或方向键。
- `Esc`/`P` 暂停。

## 规则

- 球碰左右墙反弹，碰球拍按击中位置反弹并加速（封顶 760）。
- 球过对方底线得分；先得 7 分获胜；胜场存档。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（发球/移动/反弹/击球/得分/胜负）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（球桌/球拍/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：球物理/球拍碰撞/AI/计分，固定步长 tick）
src/render/  index.js（球桌/球网/球拍/球轨迹/比分）
src/ui/      ui.js（标题/暂停/结束 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.setScore(a,b)` / `debug.movePaddle(x)` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。