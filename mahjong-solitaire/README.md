# MAHJONG SOLITAIRE

经典麻将接龙：144 张牌按「乌龟」布局五层层叠，点两张**都自由**且**同面**（花牌任意互配）的牌消掉，消光获胜。牌面全部用 Canvas 程序化绘制，无外部图片。

## 运行

```bash
cd games/mahjong-solitaire
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 方式 |
| --- | --- |
| 选牌 / 消除 | 点击两张自由同面牌 |
| 提示 | HUD 按钮（×3） |
| 撤销 | HUD 按钮（×5） |
| 洗牌 | HUD 按钮（×2，无可消对时自动高亮） |
| 暂停 | Esc / P |
| 静音 | HUD 声音按钮（持久化） |

## 语言

- 默认 **英文**；标题 / 暂停屏下拉可切 **中文**；`?lang=zh` 可覆盖，刷新保留。

## 测试与验收

```bash
node --test
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```

## 目录

```
config/game.config.js   数值 / 颜色 / 语言配置
config/layout.js        乌龟布局（144 槽位、5 层，半张牌栅格坐标）
config/locales.js       en / zh 文案
src/game/board.js       纯逻辑：自由判定 / 配对 / 反向剥离发牌 / 提示 / 撤销 / 洗牌
src/render/index.js     Canvas 渲染：绒布桌 + 程序化牌面
src/ui/ui.js            标题 / HUD / 暂停 / 通关界面
src/main.js             状态机与输入接线
src/audio.js            WebAudio 程序化音效
```

## 调试契约

`window.__ll` 暴露标准接口：`state.phase`（title / playing / paused / win）、`start / pause / resume / restart`、`sim`、`save`，以及 `debug`：

- `debug.state()` → `{ remaining, picks, phase, stars }`
- `debug.pick(index)` / `debug.hint()` / `debug.shuffle()` / `debug.autoSolvePair()`
