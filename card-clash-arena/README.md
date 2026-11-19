# CARD CLASH ARENA

> 卡牌对决竞技场 · 霓虹街机风 1v1 卡牌对决

每回合随机亮出一个属性（战力 / 活力 / 速度），从 5 张手牌里挑当前属性最高的卡与对手比牌，按差值百分比打出 2/4/6 点伤害，先打空对手 10 点生命即赢。金币可换强化 / 削弱 / 超频 / 取消技能；连胜累积连击获得额外伤害；结算按剩余生命给 1–3 星。

## 运行

```bash
cd games/card-clash-arena
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 出牌 | 点击 / 点按手牌中的卡 |
| 使用技能 | 点击底部动作条按钮 |
| 暂停 | Esc / P |
| 重开本局 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage（`card-clash-arena-lang`）。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .        # 截图 tests/final/
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node tools/make-final.mjs          # 重新生成 tests/final 截图 + poster.jpg
```

## 目录

```
index.html          入口
styles.css          样式
config/             game.config / cards / locales / design / sdk.config
src/core/           i18n、sdk、audio
src/game/sim.js     纯逻辑（可测）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         主入口（60Hz 装配 + __ll 契约）
tests/              单元测试
tools/              自对弈 / 音频验收 / 截图 / verify 计划
```

## 调试契约

`window.__ll`：`state`(phase/lang)、`start/pause/resume/restart/home`、`run/sim`、`tutorial`、`startTutorial`、`save/ui`、`debug`（win/lose/battle/setCoins/setHp/setCombo/playCard/playBest）。
