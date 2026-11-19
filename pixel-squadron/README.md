# PIXEL SQUADRON · 像素战机中队

> 霓虹战机对决外星舰队 —— 零依赖零外链的纯程序化竖版射击。

## 运行

```bash
cd pixel-squadron
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 输入 |
| --- | --- |
| 左移 | ← / A / 左半屏拖动 |
| 右移 | → / D / 右半屏拖动 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

机炮自动开火；把战机对准敌机即可击落。

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`pixel-squadron-lang`），刷新保留。
- 所有文案走 `config/locales.js`；`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .` 自检。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node tools/poster.mjs
```

## 调试契约

`window.__ll` 暴露：`state.{phase,lang}`、`start/pause/resume/restart/home`、`run`、`tutorial.{active,step,steps,current,skip}`、`startTutorial`、`debug.{state,startSeeded,loadLevel,forceWin,forceLose,setTutorialDone}`。

## 目录

```
index.html / styles.css     入口与样式（霓虹街机）
config/                     game.config / levels / locales / design / sdk.config
src/core/                   i18n / sdk / audio（纯 WebAudio 程序化）
src/game/sim.js             纯逻辑（零 DOM，Node 可测）
src/render/index.js         Canvas 程序化渲染（零素材）
src/ui/ui.js                UI 薄适配
src/main.js                 60Hz 装配 + 状态机
src/vendor/pipysdk.js       本地 SDK（source: local）
tests/                      node --test
tools/                      selfplay / audio-check / verify.plan / poster
```
