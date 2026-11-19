# DIGGER TUNNEL

> 钻洞穿隧 · Neon-arcade dig-tunnel puzzle（零构建纯静态，纯 WebAudio，全程序化美术）

## 运行

```bash
cd games/digger-tunnel
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 挖隧道 | 鼠标/手指在深色土壤上拖动 |
| 重开本关 | R / Space / ↻ 按钮 |
| 暂停 / 继续 | Esc |
| 静音 | 🔊 按钮 |

## 玩法

钻核卡在顶部口袋，下方是整块霓虹土壤。拖动钻头挖出一条隧道，让钻核靠重力坠落，
绕过**发光岩石**（挖不动），顺路吃**宝石**（连续吃触发连击加分），赶在倒计时归零前
滚进底部的**绿色传送门**。宝石越多星级越高（1–3 星）。

## 语言

- 默认英文；`?lang=zh` 或标题右上角下拉切中文。
- 文案走 `config/locales.js` 的 `t()`（en/zh 完整）。

## 测试 / 验收

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

## 目录

```
index.html          入口
styles.css          样式（霓虹街机）
config/             数值/关卡/文案/设计源/SDK 配置
src/core/           i18n、audio、sdk
src/game/sim.js     纯逻辑（网格地形 + 钻核刚体 + 挖隧道 + 事件）
src/render/         Canvas 渲染 + 粒子
src/ui/             DOM UI + 教程
src/main.js         装配 + 调试契约
tests/              单元测试
tools/              自对弈/验收计划/音频检查
```
