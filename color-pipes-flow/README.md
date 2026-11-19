# COLOR PIPES FLOW

> 霓虹管道（连接同色端口 · 填满整张棋盘）

## 运行

```bash
cd color-pipes-flow
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态：`index.html` + ES Module，`package.json` 写 `{"type":"module"}`。零运行期依赖（无 CDN/外链/字体/素材文件），美术全部程序化 canvas，音频纯 WebAudio。

## 操作

| 动作 | 操作 |
| --- | --- |
| 开始画线 | 从任意发光端口按住拖拽 |
| 延伸管道 | 沿相邻空格拖动（不能斜走/交叉/穿岩石） |
| 撤销一格 | 往回拖到上一格 |
| 提示 | 点 💡 或按 H（每关 2 次） |
| 重开 | R 或 HUD ↻ |
| 暂停/继续 | Esc 或 P |
| 静音 | M |

## 玩法

- 每关有若干对同色端口。用正交路径把同色端口连起来，并填满所有空格（岩石除外）即可通关。
- 岩石格（block）挡路，必须绕行。
- 星级：步数 ≤ par 得 3 星；步数越少越好。
- 步数超过上限判负，一键重开。

## 语言

- 默认英文；`?lang=zh` 可覆盖；选择写入 localStorage（`color-pipes-flow-lang`）。
- en / zh 双语完整。

## 测试与门禁

```bash
node --test                                                  # 单元测试（≥10 断言）
node tools/selfplay.mjs                                      # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json / levels.js / locales.js / sdk.config.js）
src/core/           i18n、存档、音频、SDK 出口
src/game/           sim（纯逻辑）+ level（关卡生成器）
src/render/         Canvas 2D 渲染（霓虹街机主题）
src/ui/             UI 语言与屏幕显隐
src/vendor/         pipysdk.js（vendored，离线降级）
src/main.js         主入口
assets/             空（零素材）
tests/              单元测试 + final 截图
tools/              自对弈 / 验收计划 / 音频验收
```

## 调试契约

`window.__ll` 暴露：`state.phase` / `state.lang`、`start(i)` / `pause()` / `resume()` / `restart()` / `run()`、
`tutorial`（active/step/steps/skip）、`startTutorial()`、`save()` / `share()`、`debug.state()` / `debug.loadLevel(i)` / `debug.solve()`。
