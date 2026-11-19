# CANDY CRUSH POP

> 霓虹街机糖果消除：滑动发光糖果，凑出三连爆裂；敲碎冰封岩石、连锁填满连击条，抢在步数/时间耗尽前冲到目标分。

## 运行

```bash
cd candy-crush-pop
python3 -m http.server 8200
# 打开 http://127.0.0.1:8200/
```

零依赖、零构建、零外链；纯静态 ES Module，`node --test` 可跑纯逻辑测试。

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 交换糖果 | 拖拽糖果向相邻方向，或点选两颗相邻糖果 |
| 提示 | 点 HUD 的 💡 或按 H |
| 暂停 / 恢复 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法规则（P0 1:1 + 新机制）

- 8×10 网格，6 种霓虹糖果；拖拽交换相邻两颗，凑 3+ 同款消除。
- 计分：每颗 10 分 + 长度奖励（3 连 +20 / 4 连 +50 / 5+ 连 +100 且每多一颗 +60）。
- **冰封岩石**：被冰封的糖果不能交换、不参与连线；消除它旁边的糖果逐层破冰。
- **连击**：一次交换引发多波级联，第 2 波 ×1.5、第 3 波 ×2.0，满 3 波奖励 1 步。
- **结算**：目标分达标即胜（剩余步数决定 1–3 星）；步数或时间耗尽未达标则败。

## 语言

- 默认英文；`?lang=zh` 或标题右上角下拉切换中文；选择写入 localStorage。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh key 完全一致。

## 测试与门禁

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
config/   game.config.js · locales.js · levels.js · design.json · sdk.config.js
src/      main.js · game/sim.js · render/index.js · ui/ui.js · core/{audio,i18n,sdk}.js · vendor/pipysdk.js
tools/    selfplay.mjs · audio-check.mjs · verify.plan.json
tests/    sim.test.mjs · levels.test.mjs
```
