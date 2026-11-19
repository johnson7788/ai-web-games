# LIL HERO SAGA · 小小勇者传说

霓虹街机横版平台跳跃：混三原色（R/Y/B）施法，冲刺穿越空洞、破彩色晶岩、连击杀敌，击败 Boss。

## 运行

```bash
cd lil-hero-saga
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态（`index.html` + ES Module），零依赖零外链，美术全程序化 canvas，音频纯 WebAudio。

## 操作

| 动作 | 键 |
| --- | --- |
| 左/右移动 | A/D 或 ←/→ |
| 跳跃（二段跳） | W / ↑ / Space |
| 蓄色施法 | 按住 J/K/L 或 1/2/3，松开释放 |
| 红 / 黄 / 蓝 | J / K / L（= R / Y / B） |
| 重开 | R |
| 暂停 | Esc / P |
| 静音 | M |

混色：红+黄=橙电，蓝+黄=绿高跳，红+蓝=紫新星，三色齐=白爆。

## 语言

默认英文；标题右上角可切中文；`?lang=zh` 可覆盖。

## 测试与验收

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

`window.__ll`：`state.phase/lang`、`start/pause/resume/restart`、`run`、`tutorial{active,step,steps}`、`startTutorial`、`debug.fastForward/startSeeded/state`。
