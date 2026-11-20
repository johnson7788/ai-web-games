# PIN & POUR（蜜糖分装）

> 改造自「拉针游戏3.0」：拉闸 → 蜂蜜流动 → 装瓶。把金色蜂蜜灌进玻璃瓶，把气泡挡进排口。

## 运行

```bash
cd games/pin-and-pour
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/触屏 |
| --- | --- |
| 抽闸板 | 点击/触屏点闸板 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 点木闸板抽出，让蜂蜜在重力下分段流动。
- 蜂蜜进**玻璃瓶**=收集；气泡进**瓶**=污染（失败）；蜂蜜进**排口**=浪费（失败）；气泡进**排口**=安全。
- `comb` 蜂巢块：蜂蜜可穿过并把它冲走，气泡过不去。
- `screen` 滤网：气泡可穿过，蜂蜜过不去。
- 12 关三场景（晨间蜂场 / 午后工坊 / 夜幕蜜窖），抽闸顺序即全部策略。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 / 关卡 / 文案 / design.json / sdk.config
src/game/sim.js           纯逻辑模拟（珠子 + 闸板 + 蜂巢/滤网）
src/game/level.js         可解性 solver（BFS 最小抽闸顺序）
src/render/index.js       程序化 Canvas 渲染（三场景 + 蜂蜜拉丝）
src/ui/ui.js              UI 薄适配
src/core/                 音频 / SDK / i18n / 存档
src/vendor/pipysdk.js     SDK vendored 副本
tests/                    纯逻辑测试
tools/                    自对弈 / 验收计划 / 录 gif / 音频验收 / 物料
```
