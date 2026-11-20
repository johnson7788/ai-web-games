# CARD LORD

> 赛博牌局 · 斗地主单机（Cyber Landlord Card Game）

零构建纯静态 HTML5 斗地主单机：叫分 → 加倍 → 出牌压上家 → 春天/反春天结算，12 段位升段。
原创改造：赛博霓虹牌桌、记牌器（剩余张数计数条）、加倍（×2 上限 64）、炸弹出牌全屏红光震屏。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触摸 |
| --- | --- |
| 选牌 | 点选手牌（触屏同） |
| 出牌 / 不出 / 提示 | Play / Pass / Hint 按钮 |
| 叫分 | 1 / 2 / 3 / 不叫 按钮 |
| 加倍 | 加倍 / 不加倍 按钮 |
| 暂停 / 继续 | Esc / P |
| 重开 / 开始 | R（结算后）/ Enter（标题） |

## 测试 / 验收

```bash
node --test                                            # 39 条纯逻辑测试
node tools/selfplay.mjs                                # 3 策略遥测（greedy 赢到第 4 段）
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .      # PASS 100
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .     # PASS
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .  # WARN
```

## 目录

```
index.html          入口        styles.css          样式
config/             配置与文案（design.json=设计源 / gameplay=段位·AI / locales=en+zh）
src/game/           纯逻辑（cards/rules/ai/engine/rng）
src/render/         赛博牌桌 Canvas 渲染
src/ui/             屏幕 / HUD / 记牌器 / 引导
src/core/           i18n / save / sdk / audio（程序化合成）
src/vendor/pipysdk.js
tools/              selfplay / audio-check / verify.plan / record-gif / poster / make-screens
tests/final/        验收截图 + vision-review
```
