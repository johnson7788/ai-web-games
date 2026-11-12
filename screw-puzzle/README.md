# SCREW OUT

> 螺丝出逃 · 拆螺丝解压解谜

点螺丝拧出来（棘轮音 + 旋转飞出），板失去支撑就掉落（震屏 + 灰尘 + 撞击音），拆光所有板过关。共 30 关。

## 运行

```bash
cd screw-puzzle
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 输入 |
| --- | --- |
| 拧螺丝 | 鼠标 / 触屏点按 |
| 暂停 / 继续 | `Escape` / `P` |
| 重开本关 / 返回 | HUD 按钮 |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`screw-puzzle-lang`），刷新保留。
- 所有可见文案走 `config/locales.js` 的 `t()`，en 与 zh 完整。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 测试

```bash
node --test
```

## 验收

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
index.html           入口
styles.css           样式
config/              关卡数据、数值、配色、文案、SDK 配置
src/core/            i18n、SDK 出口、程序化音频
src/game/            纯逻辑（关卡 / 会话）
src/render/          工业风 Canvas 渲染
src/ui/              UI
src/main.js          主入口
tests/               测试
tools/               验收计划
```

## 调试契约

`window.__ll` 暴露标准调试接口：
- `state`: `{ phase, lang }`，phase ∈ title / playing / paused / win
- `start()` / `pause()` / `resume()` / `restart()`
- `sim`: 纯逻辑 run 对象（`loadLevel` / `unscrew` / `step` / `getHud` / `state`）
- `debug.loadLevel(i)` / `debug.unscrew(id)`（无视遮挡）/ `debug.state()`
