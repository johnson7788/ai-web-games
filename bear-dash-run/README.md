# BEAR DASH RUN

> 小熊快跑 · 霓虹街机横向平台跑酷

## 运行

```bash
cd bear-dash-run
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左移 | A / ← / 左下 ◀ |
| 右移 | D / → / 左下 ▶ |
| 跳跃（二段跳） | Space / ↑ / 右下 ▲ |
| 暂停 | Esc |

## 玩法

向右冲刺，跳过岩块与激光栅、踩踏巡逻机器人、穿过加速垫拿无敌冲刺，收集星星到达终点旗帜。
连击踩踏叠加分数倍率；每关结算 1~3 星（1 完成星 + 最多 2 奖励星）。

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- en 与 zh 完整，无豆腐块。

## 验收

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

`window.__ll`：`state.phase/lang`、`start(level)/pause/resume/restart`、`run`、`tutorial{active,step,steps,skip}`、`startTutorial()`、`finish(win,stars,score)`。

## 目录

```
index.html          入口
styles.css          霓虹样式
config/             数值 / 关卡 / 文案 / design.json / sdk.config.js
src/core/           i18n、存档、audio、sdk
src/game/sim.js     纯逻辑（可测/可 bot 驱动）
src/render/         canvas 程序化渲染
src/ui/             DOM UI + 教程 + 竖屏提示
src/vendor/         本地 SDK 桩
tests/              测试
tools/              selfplay / audio-check / verify.plan / poster
poster.jpg          1280×720 封面
```
