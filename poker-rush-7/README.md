# POKER RUSH 7

> 扑克冲刺 7 · 霓虹街机记忆匹配

记住顶部目标卡的花色、点数、底色，在四泳道卡潮中点中每一张匹配牌，避开岩石与混淆卡，连击冲星过关。

## 运行

```bash
cd poker-rush-7
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零构建纯静态：`index.html` + ES Module；美术全部程序化 canvas，音频纯 WebAudio。

## 操作

| 动作 | 键 |
| --- | --- |
| 点中匹配卡 | 鼠标 / 触屏点击 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；`?lang=zh` 可覆盖，标题右上角 / 暂停屏下拉可切 **中文**。
- 全部文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 测试与门禁

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
```

## 调试契约

`window.__ll` 暴露 `{ state:{phase,lang}, start, pause, resume, restart, run, tutorial, startTutorial }`。
