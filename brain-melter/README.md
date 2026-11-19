# BRAIN MELTER · 脑洞熔炉

> 霓虹街机风的烧脑迷你谜题合集：顺序点亮 / 异类识别 / 凑数求和 / 配对消除 / 旋转对齐，
> 五类机制 × 12 关，叠加「星级 / 连击 / 限时 / 提示道具」新机制。零依赖、纯静态、程序化美术 + WebAudio。

## 运行

```bash
cd games/brain-melter
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 点节点解题 | 鼠标 / 触摸 |
| 提示 | H 或右上 💡 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题/暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`brain-melter-lang`）。
- 所有可见文案走 `config/locales.js` 的 `t()`。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll`：`state.phase/lang`、`start/pause/resume/restart/home`、`run/sim`、
`tutorial{active,step,steps}`、`startTutorial()`、`debug{loadLevel,solveLevel,fastFail,state}`。

## 目录

```
index.html       入口
styles.css       样式（HUD 不透明顶栏 / 教程卡固定底部居中 / 竖屏提示）
config/          design.json（设计源）· levels.js · locales.js · sdk.config.js · game.config.js
src/core/        i18n · save · sdk · audio（WebAudio 程序化）
src/game/        sim.js（纯逻辑，可 node --test）
src/render/      canvas 程序化霓虹渲染
src/ui/          UI 显隐 + 语言
src/vendor/      pipysdk.js（本地 vendored，热更/服务端配置地址已置空）
src/main.js      主入口 + 调试契约
tests/           单元测试
tools/           selfplay / audio-check / verify.plan.json
```
