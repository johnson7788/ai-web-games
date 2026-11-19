# HERO VS ALIENS

> 英雄大战外星人 · 发射 / 转向 / 下落攻击的垂直闯关街机

## 运行

```bash
cd hero-vs-aliens
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 发射 | 点击 / Space / Enter |
| 下落攻击 | 飞行中点击（或点击屏幕中部）/ Space |
| 空中转向 | ← → / A D（或点击屏幕左/右 1/3） |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 门禁自检

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / sdk / 程序化音频
src/game/sim.js     纯逻辑（确定性、可测）
src/render/         Canvas 程序化渲染（霓虹街机）
src/ui/             UI 显隐与语言
src/main.js         主入口（60Hz 固定步长 + 教程 + 调试契约）
src/vendor/         托管 SDK（本地 vendored）
tests/              测试
tools/              自对弈 / 验收计划 / 音频验收
```

## 调试契约

`window.__ll` 暴露标准接口：`state.phase/lang`、`start/pause/resume/restart/home`、
`tutorial`（active/step/steps/current/skip）、`startTutorial`、`debug`（state/fastForward/setTutorialDone/launch）。
