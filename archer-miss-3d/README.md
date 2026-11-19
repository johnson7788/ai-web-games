# ARCHER MISS 3D

> 射手小姐 3D · Crystal Guardian · Neon Arena

零依赖、零外链、纯静态（`index.html` + ES Module）。玩法骨架来自《美眉射手》（Cocos Creator 3.0）——站桩弓箭手：移动时不张弓，停下自动瞄准最近敌人连射；美术/音频全部程序化原创换皮（低多边形扁平霓虹风），并新增连击、岩石掩体、星级、强化水晶四个机制。

## 运行

```bash
cd archer-miss-3d
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 移动 | WASD / 方向键 / 左下摇杆 |
| 射击 | 停下自动（移动会停火） |
| 暂停 | Esc / HUD 按钮 |
| 重开 | R |
| 菜单 | HUD ⌂ |

## 语言

- 默认 **英文**；标题 / 暂停屏右上角可切 **中文**。
- `?lang=zh` 可覆盖；选择写入 localStorage。

## 测试与门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/shots.mjs    # 生成 tests/final 战斗截图 + poster.jpg
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/artifacts
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n、存档、SDK、音频
src/game/sim.js     纯逻辑（可被 node --test / selfplay 直接 import）
src/render/         Canvas 2D 程序化渲染
src/ui/             DOM UI
src/main.js         主入口（60Hz 固定步长装配 + 标准调试契约）
src/vendor/pipysdk.js  门户 SDK（本地 vendored，source=local）
tests/              测试
tools/              自对弈 / 音频验收 / 截图 / verify 计划
```

## 调试契约

`window.__ll`：`state.phase/lang/dir`、`start(level)`、`pause`、`resume`、`restart`、`run`、`tutorial`、`startTutorial`、`save`、`debug`。
