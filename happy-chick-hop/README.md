# HAPPY CHICK HOP

> 合成大西瓜式「孵化合并」：把同类小动物丢到一起，合并成更大的一只，一路孵到金鸡夺冠。
> 纯 canvas/DOM/WebAudio 程序化实现，零依赖零外链零素材文件。

## 运行

```bash
cd happy-chick-hop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 瞄准 | 鼠标移动 / 手指滑动 |
| 投放 | 点击 / 轻点 |
| 锤子（砸掉任意一只） | 先点右上角锤子，再点目标 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 同阶两只重叠 → 合并成下一阶（蛋 → 小鸡 → … → 金鸡 11 阶），加对应分数。
- 第 7 次投放会来一块**岩石**（不可合并、只能锤掉）。
- 每 4 次合并攒 1 把**锤子**（上限 3），砸掉岩石或挡路的对象。
- 3 秒内连续合并触发**连击**，得分加成。
- 别让鸡窝堆过顶部红线；孵出金鸡（10 阶）即夺冠。

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可覆盖；选择写入 localStorage，刷新保留。
- 文案全部走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 测试 / 验收

```bash
node --test                                     # ≥10 条断言
node tools/selfplay.mjs                         # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/make-final.mjs                       # 生成 vision-review 的 8 张玩法截图 + poster.jpg
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露标准接口：`state.phase/lang`、`start/pause/resume/restart/home`、
`run`（sim 实例）、`sim()`、`debug.drop/armHammer/fastForwardToWin/fastForwardToLose`、
`tutorial.skip`。

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（game.config.js = 数值；design.json = 机器可读设计源）
src/core/           sdk / 存档 / i18n / 音频
src/game/sim.js     纯逻辑（无 DOM）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         60Hz 装配
tests/              测试 + 验收截图
tools/              自对弈 / 音频验收 / 截图 / 验收计划
```
