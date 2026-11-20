# ACE GUNNER · 边城神射

西部边城神射：守住城垛，拉弓放箭，撑过十二波马匪围攻。完整契约见 [`docs/README.md`](docs/README.md)，交付报告见 [`docs/DELIVERY.md`](docs/DELIVERY.md)。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 瞄准 | 鼠标移动 / 拖动 |
| 拉弓 | 按住鼠标 / 按住 |
| 放箭 | 松开（短按=满弦，长按=按力度） |
| 换弹 | R |
| 暂停 | Esc / P |
| 静音 | M |

## 语言

默认英文；标题/暂停下拉可切中文。`?lang=zh` 可覆盖。只暴露 en/zh（其余未翻译整块不暴露）。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html          入口
styles.css          样式
config/             数值 / 关卡 / 文案 / design.json / sdk.config.js
src/core/           i18n / audio / sdk（唯一存档埋点出口）/ save
src/game/sim.js     纯逻辑模拟
src/render/         Canvas 渲染（三场景包）
src/ui/             UI 薄适配
src/main.js         主入口 / 状态机 / 调试契约
src/vendor/         pipysdk 本地副本
tests/              纯逻辑测试 + final 验收截图
tools/              自对弈 / 音频验收 / 录 gif / 海报 / verify.plan
```

## 调试契约

`window.__ll`：`state.phase` / `start` / `pause` / `resume` / `restart` / `home` / `run` / `sim` / `debug.state` / `debug.layout` / `debug.loadLevel` / `debug.startSeeded` / `debug.autoPlaceSolution` / `debug.fastForward`。
