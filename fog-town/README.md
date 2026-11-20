# FOG TOWN · 雾町寻踪

> 油灯侦探：提灯照亮迷雾，找钥匙、拨机关、抵达出口。

## 运行

```bash
cd fog-town
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 移动 | 方向键 / WASD / 点按相邻格 |
| 回声（探听机关） | Space / Echo 按钮 |
| 暂停 | Esc |
| 重开 | R（结算后） |

## 玩法

每街区在一张 12×8 迷雾网格里：**每步烧油**点亮一小圈，逐步揭雾；收集**钥匙 / 线索**、拨动**机关**打开出口门，再抵达出口。步数越少评级越高。拼齐 3 条线索触发**真相时刻**（全图短暂点亮）。三场景包随进度切换：暮巷 → 集市废墟 → 湖畔。

## 语言

默认英文，右上角 / 暂停屏下拉可切中文；`?lang=zh` 可临时覆盖，选择持久化。

## 门禁（全部自动化）

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
config/     配置与文案（design.json = 机器可读设计源）
src/core/   i18n / 存档 / SDK / 程序化音频
src/game/   sim（纯逻辑）/ mapgen（确定性地图生成）
src/render/ 场景主题 / Canvas 渲染
src/ui/     屏幕 / HUD / 首次引导
src/main.js 装配 / 固定步长 / 状态机 / __ll 契约
tools/      selfplay / verify.plan / audio-check / mkshots / record-gif / poster
```

## 调试契约

`window.__ll` 暴露标准接口：`state.phase` / `start` / `pause` / `resume` / `restart` / `tutorial` / `debug.startAt(n)` / `debug.winBlock()` / `debug.autoStep(n)`。
