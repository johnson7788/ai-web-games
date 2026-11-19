# MONKEY DASH RUN

> 猴子快跑 · 霓虹丛林竖版跑酷

## 运行

```bash
cd monkey-dash-run
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 切换车道 | 点击 / 空格 / ↑ / W |
| 去左道 / 右道 | A/← / D/→ |
| 暂停 / 继续 | Esc / P |
| 再来一局 | R（或结算屏按钮） |
| 静音 | M |

## 玩法

猴子固定在底部，世界向下滚动。左右切换车道躲避仙人掌、黄蜂、滚石；
吃香蕉叠加连击（×8 封顶），吃护盾获得 3 秒无敌，集满 3 个火花触发 3 秒冲刺
（加速 + 无敌 + 撞碎岩石加分）。速度随分数分 5 档递增。

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可覆盖；选择写入 localStorage，刷新保留。
- 所有可见文案走 `config/locales.js` 的 `t()`。

## 测试 / 验收

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

## 目录

```
index.html          入口
styles.css          样式
config/             数值 / 文案 / SDK 配置（design.json = 机器可读设计源）
src/core/           i18n、SDK、音频
src/game/sim.js     纯逻辑（Node 可测，selfplay 直接 import）
src/render/         Canvas 程序化渲染
src/ui/             UI
src/main.js         主入口 + 教程 + 调试契约
src/vendor/         pipysdk（本地托管）
tests/              测试 + 截图
tools/              验收计划 / selfplay / audio-check / poster
```

## 调试契约

`window.__ll` 暴露：`state.phase/lang`、`start/pause/resume/restart`、`run`、
`tutorial.{active,step,steps,current}`、`startTutorial`、`save`、`ui`。
