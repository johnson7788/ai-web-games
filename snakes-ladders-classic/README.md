# SNAKES LADDERS CLASSIC

> 霓虹蛇梯棋 · Neon race to cell 47

单人竞速版蛇梯棋：你和两位「谨慎的对手」掷骰竞速，率先抵达第 47 格赢得 3 星。梯子上爬、毒蛇下滑、岩石眩晕、宝石推进、幸运 6 连击。

## 运行

```bash
cd snakes-ladders-classic
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 掷骰 | 点击右下角 **ROLL** 按钮 / 空格 |
| 暂停 | Esc |
| 重开本关 | R |
| 切语言 | 标题/暂停屏右上角下拉，或 `?lang=zh` |

## 规则

- 48 格（0-47），掷 1-6 前进；超出终点回弹（`now = 2×47 - now`）。
- 落在梯子往上爬、落在蛇往下滑；先手由比点数决定，平局重掷。
- 第 2 关加入**岩石**（落在岩石眩晕、跳过下回合）；第 3 关加入**宝石**（收集并前进一步）与**幸运 6 连击**（掷出 6 再掷一次）。
- 对手只掷 1-4（谨慎），玩家有优势；名次决定 1-3 星。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 目录

```
index.html          入口
styles.css          样式
poster.jpg          海报（1280×720）
config/             配置与文案（design.json / levels.js / locales.js / sdk.config.js）
src/core/           i18n、sdk、音频
src/game/sim.js     纯逻辑（掷骰/梯蛇/岩石/宝石/连击/先手）
src/render/         Canvas 程序化棋盘（霓虹街机风，零素材）
src/ui/             DOM UI + 教程
src/main.js         60Hz 装配 + 调试契约
tests/              单元测试 + 验收截图
tools/              selfplay / verify.plan / audio-check
```

## 调试契约

`window.__ll`：`state.{phase,lang}`、`start/pause/resume/restart/roll/startAct`、`run`、`tutorial.{active,step,steps,skip,startTutorial}`、`save`、`ui`。

素材全部程序化 Canvas/SVG/DOM + 纯 WebAudio 合成，零外部资源零依赖。
